class PromptWriter {
    constructor() {
        this.projects = [];
        this.currentProject = null;
        this.isShowingDropdown = false;
        this.selectedFileIndex = -1;
        this.currentFiles = [];
        this.atPosition = -1;
        this.isContentMode = false; // 标记是否为@@内容模式
        this.projectLoadingStates = new Map(); // 记录项目文件加载状态
        this.projectFilter = ''; // 项目筛选关键词
        this.favorites = []; // 收藏列表
        this.currentFavoriteId = null; // 当前是否为收藏的提示词

        this.init();
    }
    
    async init() {
        await this.loadProjects();
        await this.loadFavorites();
        this.bindEvents();

        console.log('初始化完成，项目数量:', this.projects.length);

        if (this.projects.length > 0) {
            // 尝试恢复上次选中的项目
            const lastSelectedProjectId = localStorage.getItem('lastSelectedProjectId');
            let targetProject = null;

            if (lastSelectedProjectId) {
                targetProject = this.projects.find(p => p.id === lastSelectedProjectId);
            }

            // 如果没有找到上次选中的项目，选择第一个
            if (!targetProject) {
                targetProject = this.projects[0];
            }

            console.log('切换到项目:', targetProject);
            await this.switchProject(targetProject.id);
        } else {
            console.log('没有找到任何项目');
        }
    }
    
    async loadProjects() {
        try {
            const response = await fetch('/api/projects');
            this.projects = await response.json();
            this.renderProjectTabs();
        } catch (error) {
            console.error('加载项目失败:', error);
        }
    }
    
    renderProjectTabs() {
        const projectListContainer = document.getElementById('projectList');
        projectListContainer.innerHTML = '';

        // 筛选项目
        const filteredProjects = this.projects.filter(project => {
            if (!this.projectFilter) return true;
            const filter = this.projectFilter.toLowerCase();
            return project.name.toLowerCase().includes(filter) ||
                   project.path.toLowerCase().includes(filter);
        });

        filteredProjects.forEach(project => {
            const projectItem = document.createElement('div');
            projectItem.className = 'project-item';
            projectItem.dataset.projectId = project.id;

            if (this.currentProject && this.currentProject.id === project.id) {
                projectItem.classList.add('active');
            }

            // 检查是否正在加载
            if (this.projectLoadingStates.get(project.id)) {
                projectItem.classList.add('project-loading');
            }

            projectItem.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div class="flex-grow-1" style="cursor: pointer;">
                        <div class="project-name">${this.highlightText(project.name, this.projectFilter)}</div>
                        <div class="project-path">${this.highlightText(project.path, this.projectFilter)}</div>
                    </div>
                    <div class="project-item-actions">
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

            // 只给项目信息区域添加点击事件
            const projectInfo = projectItem.querySelector('.flex-grow-1');
            projectInfo.addEventListener('click', () => this.switchProject(project.id));

            projectListContainer.appendChild(projectItem);
        });

        // 如果没有匹配的项目，显示提示
        if (filteredProjects.length === 0 && this.projectFilter) {
            const noResultDiv = document.createElement('div');
            noResultDiv.className = 'text-center text-muted py-3';
            noResultDiv.innerHTML = '<small>没有找到匹配的项目</small>';
            projectListContainer.appendChild(noResultDiv);
        }
    }
    
    async switchProject(projectId) {
        // 保存当前项目的提示词
        if (this.currentProject) {
            await this.savePrompt();
        }

        // 切换到新项目
        this.currentProject = this.projects.find(p => p.id === projectId);
        console.log('切换项目完成，当前项目:', this.currentProject);

        // 保存选中的项目ID
        localStorage.setItem('lastSelectedProjectId', projectId);

        this.renderProjectTabs();

        // 加载新项目的提示词
        await this.loadPrompt();

        // 更新收藏相关UI
        this.renderFavoritesList();
        this.updateFavoriteButton();

        // 如果项目文件未加载，自动加载
        await this.ensureProjectFilesLoaded(projectId);
    }
    
    async loadPrompt() {
        if (!this.currentProject) return;
        
        try {
            const response = await fetch(`/api/prompts/${this.currentProject.id}`);
            const data = await response.json();
            document.getElementById('promptTextarea').value = data.prompt;
        } catch (error) {
            console.error('加载提示词失败:', error);
        }
    }
    
    async savePrompt() {
        if (!this.currentProject) return;

        const prompt = document.getElementById('promptTextarea').value;

        try {
            await fetch(`/api/prompts/${this.currentProject.id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ prompt })
            });
        } catch (error) {
            console.error('保存提示词失败:', error);
        }
    }

    async ensureProjectFilesLoaded(projectId) {
        // 检查项目文件是否已加载
        const isLoaded = this.projectLoadingStates.get(projectId + '_loaded');
        if (isLoaded) {
            console.log(`项目 ${projectId} 文件已加载，跳过`);
            return;
        }

        // 检查是否正在加载
        if (this.projectLoadingStates.get(projectId)) {
            console.log(`项目 ${projectId} 正在加载中，跳过`);
            return;
        }

        await this.loadProjectFiles(projectId);
    }

    async loadProjectFiles(projectId) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project) return;

        try {
            // 设置加载状态
            this.projectLoadingStates.set(projectId, true);
            this.renderProjectTabs();
            this.showLoadingIndicator(true);

            console.log(`开始加载项目 ${project.name} 的文件...`);
            const response = await fetch(`/api/projects/${project.id}/scan`, {
                method: 'POST'
            });
            const result = await response.json();

            // 标记为已加载
            this.projectLoadingStates.set(projectId + '_loaded', true);
            console.log(`项目 ${project.name} 文件加载完成，共 ${result.fileCount} 个文件`);

        } catch (error) {
            console.error(`加载项目 ${project.name} 文件失败:`, error);
        } finally {
            // 清除加载状态
            this.projectLoadingStates.set(projectId, false);
            this.renderProjectTabs();
            this.showLoadingIndicator(false);
        }
    }

    showLoadingIndicator(show) {
        const indicator = document.getElementById('loadingIndicator');
        indicator.style.display = show ? 'block' : 'none';
    }

    async scanProjectFiles() {
        if (!this.currentProject) return;

        try {
            console.log(`开始扫描项目文件: ${this.currentProject.name}`);
            const response = await fetch(`/api/projects/${this.currentProject.id}/scan`, {
                method: 'POST'
            });
            const result = await response.json();
            console.log(`项目文件扫描完成，共 ${result.fileCount} 个文件`);
        } catch (error) {
            console.error('扫描项目文件失败:', error);
        }
    }
    
    bindEvents() {
        const textarea = document.getElementById('promptTextarea');
        const fileDropdown = document.getElementById('fileDropdown');
        
        // 监听输入事件
        textarea.addEventListener('input', (e) => {
            this.handleInput(e);
            // 更新收藏按钮状态
            this.updateFavoriteButton();
            // 自动保存
            if (this.currentProject) {
                clearTimeout(this.saveTimeout);
                this.saveTimeout = setTimeout(() => this.savePrompt(), 1000);
            }
        });
        
        // 监听键盘事件
        textarea.addEventListener('keydown', (e) => {
            if (this.isShowingDropdown) {
                this.handleDropdownKeydown(e);
            }
        });
        
        // 点击其他地方隐藏下拉框
        document.addEventListener('click', (e) => {
            if (!textarea.contains(e.target) && !fileDropdown.contains(e.target)) {
                this.hideDropdown();
            }
        });
        
        // 模板链接事件
        document.querySelectorAll('.template-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const template = link.dataset.template;
                this.loadTemplate(template);
            });
        });
        
        // 清除按钮
        document.getElementById('clearBtn').addEventListener('click', () => {
            textarea.value = '';
            this.savePrompt();
        });
        
        // 复制按钮
        document.getElementById('copyBtn').addEventListener('click', async () => {
            try {
                // 去掉内容中文件路径前的 @ 符号
                const content = textarea.value.replace(/@([^\s]+)/g, '$1');
                await navigator.clipboard.writeText(content);
                this.showMessage('已复制到剪贴板', 'success');
            } catch (err) {
                // 降级到旧方法
                const content = textarea.value.replace(/@([^\s]+)/g, '$1');
                const tempTextarea = document.createElement('textarea');
                tempTextarea.value = content;
                document.body.appendChild(tempTextarea);
                tempTextarea.select();
                document.execCommand('copy');
                document.body.removeChild(tempTextarea);
                this.showMessage('已复制到剪贴板', 'success');
            }
        });

        // 源码复制按钮
        document.getElementById('copyWithSourceBtn').addEventListener('click', async () => {
            try {
                const content = textarea.value;
                const response = await fetch('/api/copy-with-source', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        content: content,
                        projectId: this.currentProject ? this.currentProject.id : null
                    })
                });

                if (response.ok) {
                    const result = await response.json();
                    await navigator.clipboard.writeText(result.contentWithSource);
                    this.showMessage('已复制内容和源码到剪贴板', 'success');
                } else {
                    this.showMessage('获取源码失败', 'error');
                }
            } catch (err) {
                console.error('源码复制失败:', err);
                this.showMessage('源码复制失败', 'error');
            }
        });

        // 收藏按钮
        document.getElementById('favoriteBtn').addEventListener('click', () => {
            this.toggleFavorite();
        });

        // 保存收藏确认按钮
        document.getElementById('confirmSaveFavoriteBtn').addEventListener('click', () => {
            this.saveFavorite();
        });

        // 添加项目
        document.getElementById('saveProjectBtn').addEventListener('click', () => {
            this.addProject();
        });

        // 刷新项目文件
        document.getElementById('refreshProjectBtn').addEventListener('click', () => {
            this.refreshCurrentProjectFiles();
        });

        // 编辑项目
        document.getElementById('updateProjectBtn').addEventListener('click', () => {
            this.updateProject();
        });

        // 确认删除项目
        document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
            this.confirmDeleteProject();
        });

        // 项目筛选输入框
        document.getElementById('projectFilter').addEventListener('input', (e) => {
            this.projectFilter = e.target.value;
            this.renderProjectTabs();
        });
    }
    
    handleInput(e) {
        const textarea = e.target;
        const value = textarea.value;
        const cursorPos = textarea.selectionStart;
        
        console.log('输入事件触发，光标位置:', cursorPos, '当前字符:', value[cursorPos - 1]);
        
        // 检查是否输入了连续的两个@符号
        if (value[cursorPos - 1] === '@' && value[cursorPos - 2] === '@') {
            console.log('检测到连续的 @@ 符号');
            this.atPosition = cursorPos - 2; // 记录第一个@的位置
            this.isContentMode = true; // 标记为内容模式
            this.showFileDropdown('');
        } else if (value[cursorPos - 1] === '@') {
            console.log('检测到单个 @ 符号');
            this.atPosition = cursorPos - 1;
            this.isContentMode = false; // 标记为普通模式
            this.showFileDropdown('');
        } else if (this.isShowingDropdown && this.atPosition !== -1) {
            // 检查是否是@@模式
            if (value[this.atPosition] === '@' && value[this.atPosition + 1] === '@') {
                // @@模式下，获取@@后面的内容作为过滤条件
                const filter = value.substring(this.atPosition + 2, cursorPos);
                console.log('更新@@过滤条件:', filter);
                this.isContentMode = true;
                this.showFileDropdown(filter);
            } else {
                // 普通@模式下，获取@后面的内容作为过滤条件
                const filter = value.substring(this.atPosition + 1, cursorPos);
                console.log('更新@过滤条件:', filter);
                this.isContentMode = false;
                this.showFileDropdown(filter);
            }
        } else if (this.isShowingDropdown) {
            // 如果光标移出了 @ 区域，隐藏下拉框
            const beforeCursor = value.substring(0, cursorPos);
            const lastAtIndex = beforeCursor.lastIndexOf('@');
            if (lastAtIndex === -1 || lastAtIndex !== this.atPosition) {
                this.hideDropdown();
            }
        }
    }
    
    async showFileDropdown(filter) {
        if (!this.currentProject) {
            console.log('没有当前项目');
            return;
        }
        
        console.log('显示文件下拉框，过滤条件:', filter);
        
        try {
            const response = await fetch(`/api/projects/${this.currentProject.id}/files?filter=${encodeURIComponent(filter)}`);
            this.currentFiles = await response.json();
            
            console.log('获取到文件列表:', this.currentFiles.length, '个文件');
            
            this.renderFileDropdown();
            this.isShowingDropdown = true;
            this.selectedFileIndex = -1;
        } catch (error) {
            console.error('获取文件列表失败:', error);
        }
    }
    
    renderFileDropdown() {
        const dropdown = document.getElementById('fileDropdown');
        dropdown.innerHTML = '';

        // 获取当前的过滤条件
        const currentFilter = this.getCurrentFileFilter();

        if (this.currentFiles.length === 0) {
            // 显示无匹配内容的提示
            const div = document.createElement('div');
            div.className = 'file-option no-match';
            div.textContent = '没有匹配的文件';
            div.style.color = '#6c757d';
            div.style.fontStyle = 'italic';
            div.style.cursor = 'default';
            dropdown.appendChild(div);
        } else {
            this.currentFiles.forEach((file, index) => {
                const div = document.createElement('div');
                div.className = 'file-option';
                // 使用 innerHTML 而不是 textContent 来支持高亮标签
                div.innerHTML = this.highlightText(file, currentFilter);
                div.dataset.index = index;

                div.addEventListener('click', () => {
                    this.selectFile(index);
                });

                dropdown.appendChild(div);
            });
        }

        // 定位下拉框到光标位置
        this.positionDropdownAtCursor(dropdown);

        console.log('文件下拉框已渲染，显示', this.currentFiles.length, '个选项');
    }

    positionDropdownAtCursor(dropdown) {
        const textarea = document.getElementById('promptTextarea');

        // 使用更简单的方法：基于当前光标位置和行高计算
        const textareaRect = textarea.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(textarea);

        // 获取字体信息
        const fontSize = parseInt(computedStyle.fontSize);
        const lineHeight = parseInt(computedStyle.lineHeight) || fontSize * 1.5;

        // 计算到 @ 位置的行数和列数
        const textBeforeCursor = textarea.value.substring(0, this.atPosition);
        const lines = textBeforeCursor.split('\n');
        const currentLine = lines.length - 1;
        const currentColumn = lines[lines.length - 1].length;

        // 估算字符宽度（等宽字体）
        const charWidth = fontSize * 0.6; // 大概的字符宽度

        // 计算位置
        const paddingLeft = parseInt(computedStyle.paddingLeft) || 0;
        const paddingTop = parseInt(computedStyle.paddingTop) || 0;

        const cursorX = textareaRect.left + paddingLeft + (currentColumn * charWidth);
        const cursorY = textareaRect.top + paddingTop + (currentLine * lineHeight);

        // 定位下拉框
        dropdown.style.display = 'block';
        dropdown.style.position = 'fixed';
        dropdown.style.left = cursorX + 'px';
        dropdown.style.top = (cursorY + lineHeight + 5) + 'px'; // 在当前行下方
        dropdown.style.zIndex = '1000';

        // 确保下拉框不会超出视窗
        setTimeout(() => {
            const dropdownRect = dropdown.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;

            // 如果下拉框超出右边界，向左调整
            if (dropdownRect.right > viewportWidth) {
                dropdown.style.left = Math.max(10, viewportWidth - dropdownRect.width - 10) + 'px';
            }

            // 如果下拉框超出下边界，显示在光标上方
            if (dropdownRect.bottom > viewportHeight) {
                dropdown.style.top = (cursorY - dropdownRect.height - 5) + 'px';
            }
        }, 0);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    hideDropdown() {
        document.getElementById('fileDropdown').style.display = 'none';
        this.isShowingDropdown = false;
        this.selectedFileIndex = -1;
        this.atPosition = -1;
        console.log('隐藏文件下拉框');
    }
    
    handleDropdownKeydown(e) {
        // 如果没有匹配的文件，只处理Escape键
        if (this.currentFiles.length === 0) {
            if (e.key === 'Escape') {
                e.preventDefault();
                this.hideDropdown();
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.selectedFileIndex = Math.min(this.selectedFileIndex + 1, this.currentFiles.length - 1);
                this.updateDropdownSelection();
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.selectedFileIndex = Math.max(this.selectedFileIndex - 1, -1);
                this.updateDropdownSelection();
                break;
            case 'Enter':
                e.preventDefault();
                if (this.selectedFileIndex >= 0) {
                    this.selectFile(this.selectedFileIndex);
                }
                break;
            case 'Escape':
                e.preventDefault();
                this.hideDropdown();
                break;
        }
    }
    
    updateDropdownSelection() {
        const options = document.querySelectorAll('.file-option');
        options.forEach((option, index) => {
            option.classList.toggle('active', index === this.selectedFileIndex);
        });
    }
    
    async selectFile(index) {
        const file = this.currentFiles[index];
        const textarea = document.getElementById('promptTextarea');
        const value = textarea.value;
        const cursorPos = textarea.selectionStart;
        
        // 检查是否是@@模式（内容模式）
        if (this.isContentMode) {
            console.log('@@模式，获取文件内容:', file);
            
            try {
                // 获取文件内容
                const response = await fetch(`/api/projects/${this.currentProject.id}/file-content?filePath=${encodeURIComponent(file)}`);
                
                if (response.ok) {
                    const result = await response.json();
                    
                    // 替换 @@ 和后面的过滤文本，插入文件内容
                    const beforeAt = value.substring(0, this.atPosition);
                    const afterCursor = value.substring(cursorPos);
                    
                    // 格式化文件内容，添加文件路径标识和内容标签
                    // const fileContentText = `${file}\n\`\`\`\n${result.content}\n\`\`\`\n\n`;
                    
                    const newValue = beforeAt + result.content + afterCursor;
                    
                    textarea.value = newValue;
                    // 将光标定位到插入内容的末尾
                    const newCursorPos = beforeAt.length + fileContentText.length;
                    textarea.selectionStart = textarea.selectionEnd = newCursorPos;
                    
                    this.showMessage(`已插入文件内容: ${file}`, 'success');
                } else {
                    this.showMessage('获取文件内容失败', 'error');
                    console.error('获取文件内容失败:', response.status);
                }
            } catch (error) {
                console.error('获取文件内容失败:', error);
                this.showMessage('获取文件内容失败', 'error');
            }
        } else {
            // 普通@模式，只插入文件路径
            console.log('普通@模式，插入文件路径:', file);
            
            // 替换 @ 和后面的过滤文本
            const beforeAt = value.substring(0, this.atPosition);
            const afterCursor = value.substring(cursorPos);
            const newValue = beforeAt + '@' + file + ' ' + afterCursor;
            
            textarea.value = newValue;
            textarea.selectionStart = textarea.selectionEnd = beforeAt.length + file.length + 2;
        }
        
        this.hideDropdown();
        textarea.focus();
        
        console.log('选择文件完成:', file);
    }
    
    async addProject() {
        const name = document.getElementById('projectName').value;
        const path = document.getElementById('projectPath').value;
        const includeFullPath = document.getElementById('includeFullPath').checked;
        const excludePatterns = document.getElementById('excludePatterns').value
            .split('\n')
            .map(p => p.trim())
            .filter(p => p);
        
        if (!name || !path) {
            alert('请填写项目名称和路径');
            return;
        }
        
        try {
            const response = await fetch('/api/projects', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name,
                    path,
                    includeFullPath,
                    excludePatterns
                })
            });
            
            const project = await response.json();
            this.projects.push(project);
            this.renderProjectTabs();
            
            // 清空表单
            document.getElementById('addProjectForm').reset();
            
            // 关闭模态框
            const modal = bootstrap.Modal.getInstance(document.getElementById('addProjectModal'));
            modal.hide();
            
            // 切换到新项目
            this.switchProject(project.id);
            
        } catch (error) {
            console.error('添加项目失败:', error);
            alert('添加项目失败');
        }
    }

    async refreshCurrentProjectFiles() {
        if (!this.currentProject) {
            alert('请先选择一个项目');
            return;
        }

        // 清除加载状态，强制重新加载
        this.projectLoadingStates.delete(this.currentProject.id + '_loaded');
        await this.loadProjectFiles(this.currentProject.id);
    }

    editProject(projectId) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project) return;

        // 填充编辑表单
        document.getElementById('editProjectId').value = project.id;
        document.getElementById('editProjectName').value = project.name;
        document.getElementById('editProjectPath').value = project.path;
        document.getElementById('editIncludeFullPath').checked = project.includeFullPath || false;
        document.getElementById('editExcludePatterns').value = (project.excludePatterns || []).join('\n');

        // 显示编辑模态框
        const modal = new bootstrap.Modal(document.getElementById('editProjectModal'));
        modal.show();
    }

    async updateProject() {
        const projectId = document.getElementById('editProjectId').value;
        const name = document.getElementById('editProjectName').value;
        const path = document.getElementById('editProjectPath').value;
        const includeFullPath = document.getElementById('editIncludeFullPath').checked;
        const excludePatterns = document.getElementById('editExcludePatterns').value
            .split('\n')
            .map(p => p.trim())
            .filter(p => p);

        if (!name || !path) {
            alert('请填写项目名称和路径');
            return;
        }

        try {
            const response = await fetch(`/api/projects/${projectId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name,
                    path,
                    includeFullPath,
                    excludePatterns
                })
            });

            if (response.ok) {
                const updatedProject = await response.json();

                // 更新本地项目列表
                const index = this.projects.findIndex(p => p.id === projectId);
                if (index !== -1) {
                    this.projects[index] = updatedProject;
                    if (this.currentProject && this.currentProject.id === projectId) {
                        this.currentProject = updatedProject;
                    }
                }

                // 清除文件缓存，强制重新加载
                this.projectLoadingStates.delete(projectId + '_loaded');

                this.renderProjectTabs();

                // 关闭模态框
                const modal = bootstrap.Modal.getInstance(document.getElementById('editProjectModal'));
                modal.hide();

                alert('项目更新成功');
            } else {
                alert('项目更新失败');
            }
        } catch (error) {
            console.error('更新项目失败:', error);
            alert('项目更新失败');
        }
    }

    deleteProject(projectId) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project) return;

        // 设置要删除的项目名称
        document.getElementById('deleteProjectName').textContent = project.name;
        document.getElementById('confirmDeleteBtn').dataset.projectId = projectId;

        // 显示确认删除模态框
        const modal = new bootstrap.Modal(document.getElementById('deleteProjectModal'));
        modal.show();
    }

    async confirmDeleteProject() {
        const projectId = document.getElementById('confirmDeleteBtn').dataset.projectId;

        try {
            const response = await fetch(`/api/projects/${projectId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                // 从本地列表中移除项目
                this.projects = this.projects.filter(p => p.id !== projectId);

                // 清除相关缓存
                this.projectLoadingStates.delete(projectId);
                this.projectLoadingStates.delete(projectId + '_loaded');

                // 如果删除的是当前项目，切换到其他项目
                if (this.currentProject && this.currentProject.id === projectId) {
                    if (this.projects.length > 0) {
                        await this.switchProject(this.projects[0].id);
                    } else {
                        this.currentProject = null;
                        localStorage.removeItem('lastSelectedProjectId');
                        document.getElementById('promptTextarea').value = '';
                    }
                }

                this.renderProjectTabs();

                // 关闭模态框
                const modal = bootstrap.Modal.getInstance(document.getElementById('deleteProjectModal'));
                modal.hide();

                this.showMessage('项目删除成功', 'success');
            } else {
                this.showMessage('项目删除失败', 'error');
            }
        } catch (error) {
            console.error('删除项目失败:', error);
            this.showMessage('项目删除失败', 'error');
        }
    }

    // 显示消息提示
    showMessage(message, type = 'success') {
        const messageArea = document.getElementById('messageArea');
        const messageContent = document.getElementById('messageContent');

        // 设置消息内容和样式
        messageContent.textContent = message;
        messageContent.className = `alert alert-${type === 'error' ? 'danger' : 'success'}`;

        // 显示消息
        messageArea.style.display = 'block';

        // 3秒后自动隐藏
        setTimeout(() => {
            messageArea.style.display = 'none';
        }, 3000);
    }

    // 高亮匹配的文本
    highlightText(text, filter) {
        if (!filter) return text;

        // 对于文件路径，使用更智能的高亮逻辑
        if (text.includes('/')) {
            return this.highlightFilePath(text, filter);
        } else {
            // 对于项目名称等简单文本，使用简单的正则匹配
            const regex = new RegExp(`(${filter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            return text.replace(regex, '<mark>$1</mark>');
        }
    }

    // 获取当前文件过滤条件
    getCurrentFileFilter() {
        if (this.atPosition === -1) return '';

        const textarea = document.getElementById('promptTextarea');
        const value = textarea.value;
        const cursorPos = textarea.selectionStart;

        // 获取 @ 后面的内容作为过滤条件
        return value.substring(this.atPosition + 1, cursorPos);
    }

    // 智能高亮文件路径
    highlightFilePath(filePath, filter) {
        if (!filter) return filePath;

        const filterLower = filter.toLowerCase();

        // 检查是否包含路径分隔符
        if (filterLower.includes('/')) {
            return this.highlightByPathSegments(filePath, filterLower);
        } else {
            return this.highlightBySingleSegment(filePath, filterLower);
        }
    }

    // 按路径段高亮
    highlightByPathSegments(filePath, filter) {
        const filterSegments = filter.split('/').filter(seg => seg.length > 0);
        let result = filePath;

        // 为每个过滤段在路径中找到最佳匹配并高亮
        for (const filterSegment of filterSegments) {
            result = this.highlightSegmentInPath(result, filterSegment);
        }

        return result;
    }

    // 在单个路径段中高亮
    highlightBySingleSegment(filePath, filter) {
        const pathSegments = filePath.split('/');
        const highlightedSegments = pathSegments.map(segment => {
            return this.highlightInSegment(segment, filter);
        });

        return highlightedSegments.join('/');
    }

    // 在路径中高亮特定段
    highlightSegmentInPath(filePath, filterSegment) {
        const pathSegments = filePath.split('/');
        let bestMatchIndex = -1;
        let bestMatchType = '';

        // 找到最佳匹配的段
        for (let i = 0; i < pathSegments.length; i++) {
            const segment = pathSegments[i].toLowerCase();
            const filter = filterSegment.toLowerCase();

            if (segment === filter) {
                bestMatchIndex = i;
                bestMatchType = 'exact';
                break;
            } else if (segment.startsWith(filter)) {
                if (bestMatchType !== 'exact') {
                    bestMatchIndex = i;
                    bestMatchType = 'start';
                }
            } else if (segment.includes(filter)) {
                if (bestMatchType !== 'exact' && bestMatchType !== 'start') {
                    bestMatchIndex = i;
                    bestMatchType = 'contains';
                }
            } else if (this.fuzzyMatch(segment, filter)) {
                if (bestMatchType === '') {
                    bestMatchIndex = i;
                    bestMatchType = 'fuzzy';
                }
            }
        }

        // 高亮最佳匹配的段
        if (bestMatchIndex >= 0) {
            pathSegments[bestMatchIndex] = this.highlightInSegment(pathSegments[bestMatchIndex], filterSegment);
        }

        return pathSegments.join('/');
    }

    // 在单个段中高亮
    highlightInSegment(segment, filter) {
        const segmentLower = segment.toLowerCase();
        const filterLower = filter.toLowerCase();

        if (segmentLower.includes(filterLower)) {
            // 直接包含的情况
            const regex = new RegExp(`(${filter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            return segment.replace(regex, '<mark>$1</mark>');
        } else if (this.fuzzyMatch(segmentLower, filterLower)) {
            // 模糊匹配的情况
            return this.highlightFuzzyMatch(segment, filter);
        }

        return segment;
    }

    // 检查是否模糊匹配
    fuzzyMatch(text, pattern) {
        let patternIndex = 0;
        for (let i = 0; i < text.length && patternIndex < pattern.length; i++) {
            if (text[i] === pattern[patternIndex]) {
                patternIndex++;
            }
        }
        return patternIndex === pattern.length;
    }

    // 高亮模糊匹配
    highlightFuzzyMatch(text, pattern) {
        const textLower = text.toLowerCase();
        const patternLower = pattern.toLowerCase();
        let result = '';
        let patternIndex = 0;
        let inMark = false;

        for (let i = 0; i < text.length; i++) {
            const isMatch = patternIndex < patternLower.length && textLower[i] === patternLower[patternIndex];

            if (isMatch && !inMark) {
                // 开始一个新的高亮区域
                result += '<mark>' + text[i];
                inMark = true;
                patternIndex++;
            } else if (isMatch && inMark) {
                // 继续当前的高亮区域
                result += text[i];
                patternIndex++;
            } else if (!isMatch && inMark) {
                // 结束当前的高亮区域
                result += '</mark>' + text[i];
                inMark = false;
            } else {
                // 普通字符
                result += text[i];
            }
        }

        // 如果最后还在高亮状态，需要关闭标签
        if (inMark) {
            result += '</mark>';
        }

        return result;
    }

    // 收藏功能相关方法

    // 加载收藏列表
    async loadFavorites() {
        try {
            const response = await fetch('/api/favorites');
            this.favorites = await response.json();
            this.renderFavoritesList();
            this.updateFavoriteButton();
        } catch (error) {
            console.error('加载收藏列表失败:', error);
        }
    }

    // 渲染收藏列表
    renderFavoritesList() {
        const favoritesList = document.getElementById('favoritesList');
        favoritesList.innerHTML = '';

        // 获取当前项目的收藏
        const currentProjectFavorites = this.getCurrentProjectFavorites();

        if (currentProjectFavorites.length === 0) {
            const li = document.createElement('li');
            const projectName = this.currentProject ? this.currentProject.name : '当前项目';
            li.innerHTML = `<span class="dropdown-item-text text-muted">${projectName}暂无收藏</span>`;
            favoritesList.appendChild(li);
            return;
        }

        // 添加项目标题
        if (this.currentProject) {
            const headerLi = document.createElement('li');
            headerLi.innerHTML = `<h6 class="dropdown-header">${this.escapeHtml(this.currentProject.name)} 的收藏</h6>`;
            favoritesList.appendChild(headerLi);
        }

        currentProjectFavorites.forEach(favorite => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="favorite-item" data-favorite-id="${favorite.id}">
                    <div class="favorite-name">${this.escapeHtml(favorite.name)}</div>
                    ${favorite.description ? `<div class="favorite-description">${this.escapeHtml(favorite.description)}</div>` : ''}
                    <div class="favorite-preview">${this.escapeHtml(favorite.content.substring(0, 50))}${favorite.content.length > 50 ? '...' : ''}</div>
                    <div class="favorite-actions">
                        <button class="btn btn-sm btn-outline-primary" onclick="promptWriter.loadFavorite('${favorite.id}')">加载</button>
                        <button class="btn btn-sm btn-outline-danger" onclick="promptWriter.deleteFavorite('${favorite.id}')">删除</button>
                    </div>
                </div>
            `;
            favoritesList.appendChild(li);
        });
    }

    // 获取当前项目的收藏
    getCurrentProjectFavorites() {
        if (!this.currentProject) {
            return [];
        }
        return this.favorites.filter(favorite => favorite.projectId === this.currentProject.id);
    }

    // 更新收藏按钮状态
    updateFavoriteButton() {
        const favoriteBtn = document.getElementById('favoriteBtn');
        const favoriteIcon = document.getElementById('favoriteIcon');
        const textarea = document.getElementById('promptTextarea');
        const currentContent = textarea.value;

        // 如果没有当前项目，禁用收藏按钮
        if (!this.currentProject) {
            favoriteBtn.disabled = true;
            favoriteBtn.title = '请先选择项目';
            favoriteIcon.textContent = '♡';
            this.currentFavoriteId = null;
            return;
        }

        favoriteBtn.disabled = false;
        favoriteBtn.title = '';

        // 检查当前内容是否在当前项目中已收藏
        const currentProjectFavorites = this.getCurrentProjectFavorites();
        const existingFavorite = currentProjectFavorites.find(f => f.content === currentContent);

        if (existingFavorite) {
            favoriteBtn.classList.add('favorited');
            favoriteIcon.textContent = '♥';
            this.currentFavoriteId = existingFavorite.id;
        } else {
            favoriteBtn.classList.remove('favorited');
            favoriteIcon.textContent = '♡';
            this.currentFavoriteId = null;
        }
    }

    // 切换收藏状态
    toggleFavorite() {
        const textarea = document.getElementById('promptTextarea');
        const content = textarea.value.trim();

        if (!content) {
            this.showMessage('请先输入提示词内容', 'warning');
            return;
        }

        if (this.currentFavoriteId) {
            // 已收藏，删除收藏
            this.deleteFavorite(this.currentFavoriteId);
        } else {
            // 未收藏，显示收藏对话框
            this.showSaveFavoriteModal(content);
        }
    }

    // 显示保存收藏的模态框
    showSaveFavoriteModal(content) {
        const modal = new bootstrap.Modal(document.getElementById('saveFavoriteModal'));
        const nameInput = document.getElementById('favoriteName');
        const descriptionInput = document.getElementById('favoriteDescription');
        const previewDiv = document.getElementById('favoriteContentPreview');

        // 清空表单
        nameInput.value = '';
        descriptionInput.value = '';
        previewDiv.textContent = content;

        // 自动生成名称建议
        const lines = content.split('\n').filter(line => line.trim());
        if (lines.length > 0) {
            const firstLine = lines[0].trim();
            nameInput.value = firstLine.length > 30 ? firstLine.substring(0, 30) + '...' : firstLine;
        }

        modal.show();
    }

    // 保存收藏
    async saveFavorite() {
        const nameInput = document.getElementById('favoriteName');
        const descriptionInput = document.getElementById('favoriteDescription');
        const textarea = document.getElementById('promptTextarea');

        const name = nameInput.value.trim();
        const description = descriptionInput.value.trim();
        const content = textarea.value.trim();

        if (!name) {
            this.showMessage('请输入收藏名称', 'warning');
            return;
        }

        try {
            const response = await fetch('/api/favorites', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name,
                    description,
                    content,
                    projectId: this.currentProject ? this.currentProject.id : null
                })
            });

            if (response.ok) {
                const favorite = await response.json();
                this.favorites.push(favorite);
                this.renderFavoritesList();
                this.updateFavoriteButton();

                // 关闭模态框
                const modal = bootstrap.Modal.getInstance(document.getElementById('saveFavoriteModal'));
                modal.hide();

                this.showMessage('收藏保存成功', 'success');
            } else {
                this.showMessage('保存收藏失败', 'error');
            }
        } catch (error) {
            console.error('保存收藏失败:', error);
            this.showMessage('保存收藏失败', 'error');
        }
    }

    // 加载模板内容
    loadTemplate(templateType) {
        const textarea = document.getElementById('promptTextarea');
        let templateContent = '';
        
        switch (templateType) {
            case 'simple':
                templateContent = `# 目标

# 参考

# 注意事项

`;
                break;
            case 'database':
                templateContent = `# 目标
生成mysql数据库变更脚本，不要写入文件，给我语句即可

`;
                break;
            default:
                console.warn('未知的模板类型:', templateType);
                return;
        }
        
        textarea.value = templateContent;
        this.currentFavoriteId = null;
        this.updateFavoriteButton();
        
        // 自动保存
        if (this.currentProject) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = setTimeout(() => this.savePrompt(), 1000);
        }
        
        // 聚焦到文本区域
        textarea.focus();
        textarea.setSelectionRange(templateContent.length, templateContent.length);
    }

    // 加载收藏的提示词
    loadFavorite(favoriteId) {
        const favorite = this.favorites.find(f => f.id === favoriteId);
        if (!favorite) {
            this.showMessage('收藏不存在', 'error');
            return;
        }

        // 检查收藏是否属于当前项目
        if (favorite.projectId !== this.currentProject?.id) {
            this.showMessage('该收藏不属于当前项目', 'warning');
            return;
        }

        const textarea = document.getElementById('promptTextarea');
        textarea.value = favorite.content;
        this.currentFavoriteId = favoriteId;
        this.updateFavoriteButton();

        this.showMessage(`已加载收藏: ${favorite.name}`, 'success');
    }

    // 删除收藏
    async deleteFavorite(favoriteId) {
        if (!confirm('确定要删除这个收藏吗？')) {
            return;
        }

        try {
            const response = await fetch(`/api/favorites/${favoriteId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.favorites = this.favorites.filter(f => f.id !== favoriteId);
                this.renderFavoritesList();
                this.updateFavoriteButton();
                this.showMessage('收藏已删除', 'success');
            } else {
                this.showMessage('删除收藏失败', 'error');
            }
        } catch (error) {
            console.error('删除收藏失败:', error);
            this.showMessage('删除收藏失败', 'error');
        }
    }
}

// 初始化应用
let promptWriter;
document.addEventListener('DOMContentLoaded', () => {
    promptWriter = new PromptWriter();
});
