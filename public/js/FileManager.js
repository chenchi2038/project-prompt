class FileManager {
    constructor() {
        this.currentFiles = [];
        this.isShowingDropdown = false;
        this.selectedFileIndex = -1;
        this.atPosition = -1;
        this.isContentMode = false;
    }

    async loadProjectFiles(projectId) {
        try {
            console.log(`开始加载项目 ${projectId} 的文件...`);
            const response = await fetch(`/api/projects/${projectId}/scan`, {
                method: 'POST'
            });
            const result = await response.json();
            console.log(`项目 ${projectId} 文件加载完成，共 ${result.fileCount} 个文件`);
            return result;
        } catch (error) {
            console.error(`加载项目 ${projectId} 文件失败:`, error);
            throw error;
        }
    }

    async scanProjectFiles(projectId) {
        try {
            console.log(`开始扫描项目文件: ${projectId}`);
            const response = await fetch(`/api/projects/${projectId}/scan`, {
                method: 'POST'
            });
            const result = await response.json();
            console.log(`项目文件扫描完成，共 ${result.fileCount} 个文件`);
            return result;
        } catch (error) {
            console.error('扫描项目文件失败:', error);
            throw error;
        }
    }

    async getProjectFiles(projectId, filter = '') {
        try {
            const response = await fetch(`/api/projects/${projectId}/files?filter=${encodeURIComponent(filter)}`);
            const files = await response.json();
            this.currentFiles = files;
            console.log('获取到文件列表:', this.currentFiles.length, '个文件');
            return files;
        } catch (error) {
            console.error('获取文件列表失败:', error);
            throw error;
        }
    }

    async getFileContent(projectId, filePath) {
        try {
            const response = await fetch(`/api/projects/${projectId}/file-content?filePath=${encodeURIComponent(filePath)}`);
            
            if (response.ok) {
                const result = await response.json();
                return result.content;
            } else {
                throw new Error('获取文件内容失败');
            }
        } catch (error) {
            console.error('获取文件内容失败:', error);
            throw error;
        }
    }

    handleInput(textarea) {
        const value = textarea.value;
        const cursorPos = textarea.selectionStart;
        
        console.log('输入事件触发，光标位置:', cursorPos, '当前字符:', value[cursorPos - 1]);
        
        // 检查是否输入了连续的两个@符号
        if (value[cursorPos - 1] === '@' && value[cursorPos - 2] === '@') {
            console.log('检测到连续的 @@ 符号');
            this.atPosition = cursorPos - 2;
            this.isContentMode = true;
            return { showDropdown: true, filter: '' };
        } else if (value[cursorPos - 1] === '@') {
            console.log('检测到单个 @ 符号');
            this.atPosition = cursorPos - 1;
            this.isContentMode = false;
            return { showDropdown: true, filter: '' };
        } else if (this.isShowingDropdown && this.atPosition !== -1) {
            // 检查是否是@@模式
            if (value[this.atPosition] === '@' && value[this.atPosition + 1] === '@') {
                const filter = value.substring(this.atPosition + 2, cursorPos);
                console.log('更新@@过滤条件:', filter);
                this.isContentMode = true;
                return { showDropdown: true, filter };
            } else {
                const filter = value.substring(this.atPosition + 1, cursorPos);
                console.log('更新@过滤条件:', filter);
                this.isContentMode = false;
                return { showDropdown: true, filter };
            }
        } else if (this.isShowingDropdown) {
            // 检查是否光标移出了 @ 区域
            const beforeCursor = value.substring(0, cursorPos);
            const lastAtIndex = beforeCursor.lastIndexOf('@');
            if (lastAtIndex === -1 || lastAtIndex !== this.atPosition) {
                return { hideDropdown: true };
            }
        }
        
        return { noAction: true };
    }

    getCurrentFileFilter(textarea) {
        if (this.atPosition === -1) return '';

        const value = textarea.value;
        const cursorPos = textarea.selectionStart;

        return value.substring(this.atPosition + 1, cursorPos);
    }

    handleDropdownKeydown(e) {
        if (this.currentFiles.length === 0) {
            if (e.key === 'Escape') {
                e.preventDefault();
                return { action: 'hide' };
            }
            return { action: 'none' };
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.selectedFileIndex = Math.min(this.selectedFileIndex + 1, this.currentFiles.length - 1);
                return { action: 'updateSelection' };
            case 'ArrowUp':
                e.preventDefault();
                this.selectedFileIndex = Math.max(this.selectedFileIndex - 1, -1);
                return { action: 'updateSelection' };
            case 'Enter':
                e.preventDefault();
                if (this.selectedFileIndex >= 0) {
                    return { action: 'select', fileIndex: this.selectedFileIndex };
                }
                break;
            case 'Escape':
                e.preventDefault();
                return { action: 'hide' };
        }
        return { action: 'none' };
    }

    async selectFile(index, textarea, projectId, onSuccess, onError, hideDropdownCallback) {
        const file = this.currentFiles[index];
        const value = textarea.value;
        const cursorPos = textarea.selectionStart;
        
        if (this.isContentMode) {
            console.log('@@模式，获取文件内容:', file);
            
            try {
                const content = await this.getFileContent(projectId, file);
                
                const beforeAt = value.substring(0, this.atPosition);
                const afterCursor = value.substring(cursorPos);
                const newValue = beforeAt + content + afterCursor;
                
                textarea.value = newValue;
                const newCursorPos = beforeAt.length + content.length;
                textarea.selectionStart = textarea.selectionEnd = newCursorPos;
                
                if (onSuccess) onSuccess(`已插入文件内容: ${file}`);
            } catch (error) {
                if (onError) onError('获取文件内容失败');
            }
        } else {
            console.log('普通@模式，插入文件路径:', file);
            
            const beforeAt = value.substring(0, this.atPosition);
            const afterCursor = value.substring(cursorPos);
            const newValue = beforeAt + '@' + file + ' ' + afterCursor;
            
            textarea.value = newValue;
            textarea.selectionStart = textarea.selectionEnd = beforeAt.length + file.length + 2;
        }
        
        // 通过回调隐藏下拉框，确保DOM元素也被隐藏
        if (hideDropdownCallback) {
            hideDropdownCallback();
        }
        this.hideDropdown();
        textarea.focus();
        console.log('选择文件完成:', file);
    }

    showDropdown() {
        this.isShowingDropdown = true;
        this.selectedFileIndex = -1;
    }

    hideDropdown() {
        this.isShowingDropdown = false;
        this.selectedFileIndex = -1;
        this.atPosition = -1;
        console.log('隐藏文件下拉框');
    }

    reset() {
        this.currentFiles = [];
        this.hideDropdown();
    }
}