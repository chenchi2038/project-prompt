class PromptWriter {
    constructor() {
        this.projectManager = new ProjectManager();
        this.fileManager = new FileManager();
        this.favoriteManager = new FavoriteManager();
        this.claudeProxyManager = new ClaudeProxyManager(UIUtils);

        this.saveTimeout = null;

        this.init();
    }

    async init() {
        await this.loadData();
        this.bindEvents();

        console.log('初始化完成，项目数量:', this.projectManager.projects.length);

        const targetProject = this.projectManager.restoreLastSelectedProject();
        if (targetProject) {
            console.log('切换到项目:', targetProject);
            await this.switchProject(targetProject.id);
        } else {
            console.log('没有找到任何项目');
        }
    }

    async loadData() {
        await this.projectManager.loadProjects();
        await this.favoriteManager.loadFavorites();
        await this.claudeProxyManager.loadProxies();
        this.renderProjectTabs();
    }
    
    renderProjectTabs() {
        const projectListContainer = document.getElementById('projectList');
        projectListContainer.innerHTML = '';

        const filteredProjects = this.projectManager.getFilteredProjects();

        if (filteredProjects.length === 0 && this.projectManager.projectFilter) {
            const noResultDiv = document.createElement('div');
            noResultDiv.className = 'text-center text-muted py-3';
            noResultDiv.innerHTML = '<small>没有找到匹配的项目</small>';
            projectListContainer.appendChild(noResultDiv);
            return;
        }

        filteredProjects.forEach(project => {
            const projectItem = document.createElement('div');
            projectItem.className = 'project-item';
            projectItem.dataset.projectId = project.id;

            if (this.projectManager.currentProject && this.projectManager.currentProject.id === project.id) {
                projectItem.classList.add('active');
            }

            if (this.projectManager.isProjectLoading(project.id)) {
                projectItem.classList.add('project-loading');
            }

            projectItem.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div class="flex-grow-1" style="cursor: pointer;">
                        <div class="project-name">${UIUtils.highlightText(project.name, this.projectManager.projectFilter)}</div>
                        <div class="project-path">${UIUtils.highlightText(project.path, this.projectManager.projectFilter)}</div>
                    </div>
                    <div class="project-item-actions">
                        <button class="btn btn-outline-info btn-sm btn-icon icon-up"
                                onclick="event.stopPropagation(); promptWriter.moveProjectUp('${project.id}')"
                                title="上移">
                        </button>
                        <button class="btn btn-outline-info btn-sm btn-icon icon-down"
                                onclick="event.stopPropagation(); promptWriter.moveProjectDown('${project.id}')"
                                title="下移">
                        </button>
                        <button class="btn btn-outline-secondary btn-sm btn-icon icon-edit"
                                onclick="event.stopPropagation(); promptWriter.editProject('${project.id}')"
                                title="编辑项目">
                        </button>
                        <button class="btn btn-outline-danger btn-sm btn-icon icon-delete"
                                onclick="event.stopPropagation(); promptWriter.deleteProject('${project.id}')"
                                title="删除项目">
                        </button>
                    </div>
                </div>
            `;

            const projectInfo = projectItem.querySelector('.flex-grow-1');
            projectInfo.addEventListener('click', () => this.switchProject(project.id));

            projectListContainer.appendChild(projectItem);
        });
    }
    
    async switchProject(projectId) {
        if (this.projectManager.currentProject) {
            await this.projectManager.savePrompt(document.getElementById('promptTextarea').value);
        }

        this.projectManager.switchProject(projectId);
        console.log('切换项目完成，当前项目:', this.projectManager.currentProject);

        this.renderProjectTabs();

        const prompt = await this.projectManager.loadPrompt();
        document.getElementById('promptTextarea').value = prompt;

        this.renderFavoritesList();
        this.updateFavoriteButton();

        await this.ensureProjectFilesLoaded(projectId);
    }

    async ensureProjectFilesLoaded(projectId) {
        if (this.projectManager.isProjectLoaded(projectId)) {
            console.log(`项目 ${projectId} 文件已加载，跳过`);
            return;
        }

        if (this.projectManager.isProjectLoading(projectId)) {
            console.log(`项目 ${projectId} 正在加载中，跳过`);
            return;
        }

        await this.loadProjectFiles(projectId);
    }

    async loadProjectFiles(projectId) {
        const project = this.projectManager.findProjectById(projectId);
        if (!project) return;

        try {
            this.projectManager.setProjectLoadingState(projectId, true);
            this.renderProjectTabs();
            UIUtils.showLoadingIndicator(true);

            const result = await this.fileManager.loadProjectFiles(projectId);

            this.projectManager.setProjectLoadedState(projectId, true);
            console.log(`项目 ${project.name} 文件加载完成，共 ${result.fileCount} 个文件`);

        } catch (error) {
            console.error(`加载项目 ${project.name} 文件失败:`, error);
        } finally {
            this.projectManager.setProjectLoadingState(projectId, false);
            this.renderProjectTabs();
            UIUtils.showLoadingIndicator(false);
        }
    }
    
    bindEvents() {
        const textarea = document.getElementById('promptTextarea');
        const fileDropdown = document.getElementById('fileDropdown');
        
        textarea.addEventListener('input', (e) => {
            this.handleInput(e);
            this.updateFavoriteButton();
            this.autoSave();
        });
        
        textarea.addEventListener('keydown', (e) => {
            if (this.fileManager.isShowingDropdown) {
                this.handleDropdownKeydown(e);
            }
        });
        
        document.addEventListener('click', (e) => {
            if (!textarea.contains(e.target) && !fileDropdown.contains(e.target)) {
                this.hideDropdown();
            }
        });
        
        this.bindTemplateEvents();
        this.bindButtonEvents();
        this.bindProjectEvents();
        this.bindFavoriteEvents();
        this.bindClaudeProxyEvents();

        document.getElementById('projectFilter').addEventListener('input', (e) => {
            this.projectManager.projectFilter = e.target.value;
            this.renderProjectTabs();
        });
    }

    bindClaudeProxyEvents() {
        document.getElementById('addClaudeProxyBtn').addEventListener('click', () => {
            this.claudeProxyManager.showAddProxyDialog();
        });

        document.getElementById('saveClaudeProxyBtn').addEventListener('click', () => {
            this.claudeProxyManager.saveProxy();
        });

        // Token 可见性切换
        document.getElementById('toggleTokenVisibility').addEventListener('click', () => {
            const tokenInput = document.getElementById('proxyToken');
            const icon = document.getElementById('tokenVisibilityIcon');
            if (tokenInput.type === 'password') {
                tokenInput.type = 'text';
                icon.textContent = '🙈';
            } else {
                tokenInput.type = 'password';
                icon.textContent = '👁️';
            }
        });

        // 当打开代理设置模态框时重新加载代理列表
        const proxySettingsModal = document.getElementById('claudeProxySettingsModal');
        proxySettingsModal.addEventListener('show.bs.modal', () => {
            this.claudeProxyManager.loadProxies();
        });
    }

    bindTemplateEvents() {
        document.querySelectorAll('.template-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const template = link.dataset.template;
                this.loadTemplate(template);
            });
        });
    }

    bindButtonEvents() {
        const textarea = document.getElementById('promptTextarea');

        document.getElementById('clearBtn').addEventListener('click', () => {
            textarea.value = '';
            this.projectManager.savePrompt('');
        });
        
        document.getElementById('copyBtn').addEventListener('click', async () => {
            const content = textarea.value.replace(/@([^\s]+)/g, '$1');
            await UIUtils.copyToClipboard(content);
        });

        document.getElementById('copyWithSourceBtn').addEventListener('click', async () => {
            await this.copyWithSource();
        });
    }

    bindProjectEvents() {
        document.getElementById('saveProjectBtn').addEventListener('click', () => {
            this.addProject();
        });

        document.getElementById('refreshProjectBtn').addEventListener('click', () => {
            this.refreshCurrentProjectFiles();
        });

        document.getElementById('updateProjectBtn').addEventListener('click', () => {
            this.updateProject();
        });

        document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
            this.confirmDeleteProject();
        });
    }

    bindFavoriteEvents() {
        document.getElementById('favoriteBtn').addEventListener('click', () => {
            this.toggleFavorite();
        });

        document.getElementById('confirmSaveFavoriteBtn').addEventListener('click', () => {
            this.saveFavorite();
        });
    }

    autoSave() {
        if (this.projectManager.currentProject) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = setTimeout(() => {
                this.projectManager.savePrompt(document.getElementById('promptTextarea').value);
            }, 1000);
        }
    }
    
    handleInput(e) {
        const result = this.fileManager.handleInput(e.target);
        
        if (result.showDropdown) {
            this.showFileDropdown(result.filter);
        } else if (result.hideDropdown) {
            this.hideDropdown();
        }
    }
    
    async showFileDropdown(filter) {
        if (!this.projectManager.currentProject) {
            console.log('没有当前项目');
            return;
        }
        
        console.log('显示文件下拉框，过滤条件:', filter);
        
        try {
            await this.fileManager.getProjectFiles(this.projectManager.currentProject.id, filter);
            this.renderFileDropdown();
            this.fileManager.showDropdown();
        } catch (error) {
            console.error('获取文件列表失败:', error);
        }
    }
    
    renderFileDropdown() {
        const dropdown = document.getElementById('fileDropdown');
        dropdown.innerHTML = '';

        const currentFilter = this.fileManager.getCurrentFileFilter(document.getElementById('promptTextarea'));

        if (this.fileManager.currentFiles.length === 0) {
            const div = document.createElement('div');
            div.className = 'file-option no-match';
            div.textContent = '没有匹配的文件';
            div.style.cssText = 'color: #6c757d; font-style: italic; cursor: default;';
            dropdown.appendChild(div);
        } else {
            this.fileManager.currentFiles.forEach((file, index) => {
                const div = document.createElement('div');
                div.className = 'file-option';
                div.innerHTML = UIUtils.highlightText(file, currentFilter);
                div.dataset.index = index;

                div.addEventListener('click', () => {
                    this.selectFile(index);
                });

                dropdown.appendChild(div);
            });
        }

        UIUtils.positionDropdownAtCursor(dropdown, document.getElementById('promptTextarea'), this.fileManager.atPosition);
        console.log('文件下拉框已渲染，显示', this.fileManager.currentFiles.length, '个选项');
    }

    hideDropdown() {
        document.getElementById('fileDropdown').style.display = 'none';
        this.fileManager.hideDropdown();
    }
    
    handleDropdownKeydown(e) {
        const result = this.fileManager.handleDropdownKeydown(e);
        
        switch (result.action) {
            case 'updateSelection':
                this.updateDropdownSelection();
                break;
            case 'select':
                this.selectFile(result.fileIndex);
                break;
            case 'hide':
                this.hideDropdown();
                break;
        }
    }
    
    updateDropdownSelection() {
        const options = document.querySelectorAll('.file-option');
        options.forEach((option, index) => {
            option.classList.toggle('active', index === this.fileManager.selectedFileIndex);
        });
    }
    
    async selectFile(index) {
        const textarea = document.getElementById('promptTextarea');
        
        await this.fileManager.selectFile(
            index, 
            textarea, 
            this.projectManager.currentProject.id,
            (message) => UIUtils.showMessage(message, 'success'),
            (message) => UIUtils.showMessage(message, 'error'),
            () => this.hideDropdown() // 传入隐藏下拉框的回调
        );
    }
    
    async addProject() {
        const projectData = {
            name: document.getElementById('projectName').value,
            path: document.getElementById('projectPath').value,
            includeFullPath: document.getElementById('includeFullPath').checked,
            excludePatterns: document.getElementById('excludePatterns').value
                .split('\n')
                .map(p => p.trim())
                .filter(p => p)
        };
        
        try {
            const project = await this.projectManager.addProject(projectData);
            this.renderProjectTabs();
            
            UIUtils.clearForm('addProjectForm');
            UIUtils.hideModal('addProjectModal');
            
            this.switchProject(project.id);
            
        } catch (error) {
            UIUtils.showMessage(error.message, 'error');
        }
    }

    async refreshCurrentProjectFiles() {
        if (!this.projectManager.currentProject) {
            UIUtils.showMessage('请先选择一个项目', 'error');
            return;
        }

        this.projectManager.setProjectLoadedState(this.projectManager.currentProject.id, false);
        await this.loadProjectFiles(this.projectManager.currentProject.id);
    }

    editProject(projectId) {
        const project = this.projectManager.findProjectById(projectId);
        if (!project) return;

        document.getElementById('editProjectId').value = project.id;
        document.getElementById('editProjectName').value = project.name;
        document.getElementById('editProjectPath').value = project.path;
        document.getElementById('editIncludeFullPath').checked = project.includeFullPath || false;
        document.getElementById('editExcludePatterns').value = (project.excludePatterns || []).join('\n');

        UIUtils.showModal('editProjectModal');
    }

    async updateProject() {
        const projectId = document.getElementById('editProjectId').value;
        const projectData = {
            name: document.getElementById('editProjectName').value,
            path: document.getElementById('editProjectPath').value,
            includeFullPath: document.getElementById('editIncludeFullPath').checked,
            excludePatterns: document.getElementById('editExcludePatterns').value
                .split('\n')
                .map(p => p.trim())
                .filter(p => p)
        };

        try {
            await this.projectManager.updateProject(projectId, projectData);
            this.renderProjectTabs();
            UIUtils.hideModal('editProjectModal');
            UIUtils.showMessage('项目更新成功', 'success');
        } catch (error) {
            UIUtils.showMessage(error.message, 'error');
        }
    }

    deleteProject(projectId) {
        const project = this.projectManager.findProjectById(projectId);
        if (!project) return;

        document.getElementById('deleteProjectName').textContent = project.name;
        document.getElementById('confirmDeleteBtn').dataset.projectId = projectId;

        UIUtils.showModal('deleteProjectModal');
    }

    async confirmDeleteProject() {
        const projectId = document.getElementById('confirmDeleteBtn').dataset.projectId;

        try {
            const result = await this.projectManager.deleteProject(projectId);

            if (result.needSwitchProject) {
                if (result.hasOtherProjects) {
                    await this.switchProject(this.projectManager.projects[0].id);
                } else {
                    document.getElementById('promptTextarea').value = '';
                }
            }

            this.renderProjectTabs();
            UIUtils.hideModal('deleteProjectModal');
            UIUtils.showMessage('项目删除成功', 'success');
        } catch (error) {
            UIUtils.showMessage(error.message, 'error');
        }
    }

    async moveProjectUp(projectId) {
        try {
            await this.projectManager.moveProjectUp(projectId);
            this.renderProjectTabs();
            UIUtils.showMessage('项目上移成功', 'success');
        } catch (error) {
            UIUtils.showMessage(error.message, 'error');
        }
    }

    async moveProjectDown(projectId) {
        try {
            await this.projectManager.moveProjectDown(projectId);
            this.renderProjectTabs();
            UIUtils.showMessage('项目下移成功', 'success');
        } catch (error) {
            UIUtils.showMessage(error.message, 'error');
        }
    }

    renderFavoritesList() {
        const favoritesList = document.getElementById('favoritesList');
        favoritesList.innerHTML = '';

        const currentProjectFavorites = this.favoriteManager.getCurrentProjectFavorites(
            this.projectManager.currentProject?.id
        );

        if (currentProjectFavorites.length === 0) {
            const li = document.createElement('li');
            const projectName = this.projectManager.currentProject ? this.projectManager.currentProject.name : '当前项目';
            li.innerHTML = `<span class="dropdown-item-text text-muted">${projectName}暂无收藏</span>`;
            favoritesList.appendChild(li);
            return;
        }

        if (this.projectManager.currentProject) {
            const headerLi = document.createElement('li');
            headerLi.innerHTML = `<h6 class="dropdown-header">${UIUtils.escapeHtml(this.projectManager.currentProject.name)} 的收藏</h6>`;
            favoritesList.appendChild(headerLi);
        }

        currentProjectFavorites.forEach(favorite => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="favorite-item" data-favorite-id="${favorite.id}">
                    <div class="favorite-name">${UIUtils.escapeHtml(favorite.name)}</div>
                    ${favorite.description ? `<div class="favorite-description">${UIUtils.escapeHtml(favorite.description)}</div>` : ''}
                    <div class="favorite-preview">${UIUtils.escapeHtml(favorite.content.substring(0, 50))}${favorite.content.length > 50 ? '...' : ''}</div>
                    <div class="favorite-actions">
                        <button class="btn btn-sm btn-outline-primary" onclick="promptWriter.loadFavorite('${favorite.id}')">加载</button>
                        <button class="btn btn-sm btn-outline-danger" onclick="promptWriter.deleteFavorite('${favorite.id}')">删除</button>
                    </div>
                </div>
            `;
            favoritesList.appendChild(li);
        });
    }

    updateFavoriteButton() {
        const favoriteBtn = document.getElementById('favoriteBtn');
        const favoriteIcon = document.getElementById('favoriteIcon');
        const textarea = document.getElementById('promptTextarea');
        const currentContent = textarea.value;

        if (!this.projectManager.currentProject) {
            favoriteBtn.disabled = true;
            favoriteBtn.title = '请先选择项目';
            favoriteIcon.textContent = '♡';
            this.favoriteManager.clearCurrentFavorite();
            return;
        }

        favoriteBtn.disabled = false;
        favoriteBtn.title = '';

        const existingFavorite = this.favoriteManager.checkCurrentFavorite(currentContent, this.projectManager.currentProject.id);

        if (existingFavorite) {
            favoriteBtn.classList.add('favorited');
            favoriteIcon.textContent = '♥';
        } else {
            favoriteBtn.classList.remove('favorited');
            favoriteIcon.textContent = '♡';
        }
    }

    toggleFavorite() {
        const textarea = document.getElementById('promptTextarea');
        const content = textarea.value.trim();

        if (!content) {
            UIUtils.showMessage('请先输入提示词内容', 'warning');
            return;
        }

        if (this.favoriteManager.currentFavoriteId) {
            this.deleteFavorite(this.favoriteManager.currentFavoriteId);
        } else {
            this.showSaveFavoriteModal(content);
        }
    }

    showSaveFavoriteModal(content) {
        const nameInput = document.getElementById('favoriteName');
        const descriptionInput = document.getElementById('favoriteDescription');
        const previewDiv = document.getElementById('favoriteContentPreview');

        nameInput.value = '';
        descriptionInput.value = '';
        previewDiv.textContent = content;

        nameInput.value = this.favoriteManager.generateSuggestedName(content);

        UIUtils.showModal('saveFavoriteModal');
    }

    async saveFavorite() {
        const favoriteData = {
            name: document.getElementById('favoriteName').value,
            description: document.getElementById('favoriteDescription').value,
            content: document.getElementById('promptTextarea').value,
            projectId: this.projectManager.currentProject?.id
        };

        try {
            await this.favoriteManager.saveFavorite(favoriteData);
            this.renderFavoritesList();
            this.updateFavoriteButton();

            UIUtils.hideModal('saveFavoriteModal');
            UIUtils.showMessage('收藏保存成功', 'success');
        } catch (error) {
            UIUtils.showMessage(error.message, 'error');
        }
    }

    loadFavorite(favoriteId) {
        try {
            const favorite = this.favoriteManager.validateFavoriteForProject(favoriteId, this.projectManager.currentProject?.id);

            const textarea = document.getElementById('promptTextarea');
            textarea.value = favorite.content;
            this.favoriteManager.setCurrentFavorite(favoriteId);
            this.updateFavoriteButton();

            UIUtils.showMessage(`已加载收藏: ${favorite.name}`, 'success');
        } catch (error) {
            UIUtils.showMessage(error.message, 'error');
        }
    }

    async deleteFavorite(favoriteId) {
        if (!confirm('确定要删除这个收藏吗？')) {
            return;
        }

        try {
            await this.favoriteManager.deleteFavorite(favoriteId);
            this.renderFavoritesList();
            this.updateFavoriteButton();
            UIUtils.showMessage('收藏已删除', 'success');
        } catch (error) {
            UIUtils.showMessage(error.message, 'error');
        }
    }

    loadTemplate(templateType) {
        const templateContent = UIUtils.generateTemplateContent(templateType);
        if (!templateContent) return;

        const textarea = document.getElementById('promptTextarea');
        textarea.value = templateContent;
        this.favoriteManager.clearCurrentFavorite();
        this.updateFavoriteButton();
        
        this.autoSave();
        
        textarea.focus();
        textarea.setSelectionRange(templateContent.length, templateContent.length);
    }

    async copyWithSource() {
        try {
            const textarea = document.getElementById('promptTextarea');
            const content = textarea.value;
            const response = await fetch('/api/copy-with-source', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content: content,
                    projectId: this.projectManager.currentProject ? this.projectManager.currentProject.id : null
                })
            });

            if (response.ok) {
                const result = await response.json();
                await UIUtils.copyToClipboard(result.contentWithSource, '已复制内容和源码到剪贴板');
            } else {
                UIUtils.showMessage('获取源码失败', 'error');
            }
        } catch (err) {
            console.error('源码复制失败:', err);
            UIUtils.showMessage('源码复制失败', 'error');
        }
    }
}

let promptWriter;
document.addEventListener('DOMContentLoaded', () => {
    promptWriter = new PromptWriter();
});