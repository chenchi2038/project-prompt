class PromptWriter {
    constructor() {
        this.projects = [];
        this.currentProject = null;
        this.isShowingDropdown = false;
        this.selectedFileIndex = -1;
        this.currentFiles = [];
        this.atPosition = -1;
        this.projectLoadingStates = new Map(); // 记录项目文件加载状态
        this.projectFilter = ''; // 项目筛选关键词

        this.init();
    }
    
    async init() {
        await this.loadProjects();
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
        
        // 检查是否输入了 @
        if (value[cursorPos - 1] === '@') {
            console.log('检测到 @ 符号');
            this.atPosition = cursorPos - 1;
            this.showFileDropdown('');
        } else if (this.isShowingDropdown && this.atPosition !== -1) {
            // 获取 @ 后面的内容作为过滤条件
            const filter = value.substring(this.atPosition + 1, cursorPos);
            console.log('更新过滤条件:', filter);
            this.showFileDropdown(filter);
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
                div.textContent = file;
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
    
    selectFile(index) {
        const file = this.currentFiles[index];
        const textarea = document.getElementById('promptTextarea');
        const value = textarea.value;
        const cursorPos = textarea.selectionStart;
        
        // 替换 @ 和后面的过滤文本
        const beforeAt = value.substring(0, this.atPosition);
        const afterCursor = value.substring(cursorPos);
        const newValue = beforeAt + '@' + file + ' ' + afterCursor;
        
        textarea.value = newValue;
        textarea.selectionStart = textarea.selectionEnd = beforeAt.length + file.length + 2;
        
        this.hideDropdown();
        textarea.focus();
        
        console.log('选择文件:', file);
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

        const regex = new RegExp(`(${filter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }
}

// 初始化应用
let promptWriter;
document.addEventListener('DOMContentLoaded', () => {
    promptWriter = new PromptWriter();
});
