class ProjectManager {
    constructor() {
        this.projects = [];
        this.currentProject = null;
        this.projectLoadingStates = new Map();
        this.projectFilter = '';
    }

    async loadProjects() {
        try {
            const response = await fetch('/api/projects');
            this.projects = await response.json();
            return this.projects;
        } catch (error) {
            console.error('加载项目失败:', error);
            throw error;
        }
    }

    async addProject(projectData) {
        const { name, path, includeFullPath, excludePatterns } = projectData;
        
        if (!name || !path) {
            throw new Error('请填写项目名称和路径');
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
            return project;
        } catch (error) {
            console.error('添加项目失败:', error);
            throw error;
        }
    }

    async updateProject(projectId, projectData) {
        const { name, path, includeFullPath, excludePatterns } = projectData;

        if (!name || !path) {
            throw new Error('请填写项目名称和路径');
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
                
                const index = this.projects.findIndex(p => p.id === projectId);
                if (index !== -1) {
                    this.projects[index] = updatedProject;
                    if (this.currentProject && this.currentProject.id === projectId) {
                        this.currentProject = updatedProject;
                    }
                }

                this.projectLoadingStates.delete(projectId + '_loaded');
                return updatedProject;
            } else {
                throw new Error('项目更新失败');
            }
        } catch (error) {
            console.error('更新项目失败:', error);
            throw error;
        }
    }

    async deleteProject(projectId) {
        try {
            const response = await fetch(`/api/projects/${projectId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.projects = this.projects.filter(p => p.id !== projectId);
                
                this.projectLoadingStates.delete(projectId);
                this.projectLoadingStates.delete(projectId + '_loaded');

                const needSwitchProject = this.currentProject && this.currentProject.id === projectId;
                
                if (needSwitchProject) {
                    this.currentProject = null;
                    localStorage.removeItem('activeProjectId');
                }
                
                return { needSwitchProject, hasOtherProjects: this.projects.length > 0 };
            } else {
                throw new Error('项目删除失败');
            }
        } catch (error) {
            console.error('删除项目失败:', error);
            throw error;
        }
    }

    async switchProject(projectId) {
        this.currentProject = this.projects.find(p => p.id === projectId);
        localStorage.setItem('activeProjectId', projectId);
        
        try {
            await fetch(`/api/active-project/${projectId}`, {
                method: 'PUT'
            });
        } catch (error) {
            console.error('保存激活项目失败:', error);
        }
        
        return this.currentProject;
    }

    getFilteredProjects() {
        if (!this.projectFilter) return this.projects;
        
        const filter = this.projectFilter.toLowerCase();
        return this.projects.filter(project => 
            project.name.toLowerCase().includes(filter) ||
            project.path.toLowerCase().includes(filter)
        );
    }

    isProjectLoading(projectId) {
        return this.projectLoadingStates.get(projectId) === true;
    }

    isProjectLoaded(projectId) {
        return this.projectLoadingStates.get(projectId + '_loaded') === true;
    }

    setProjectLoadingState(projectId, isLoading) {
        this.projectLoadingStates.set(projectId, isLoading);
    }

    setProjectLoadedState(projectId, isLoaded) {
        this.projectLoadingStates.set(projectId + '_loaded', isLoaded);
    }

    findProjectById(projectId) {
        return this.projects.find(p => p.id === projectId);
    }

    async loadPrompt(projectId = null) {
        const targetProjectId = projectId || this.currentProject?.id;
        if (!targetProjectId) return '';
        
        try {
            const response = await fetch(`/api/prompts/${targetProjectId}`);
            const data = await response.json();
            return data.prompt;
        } catch (error) {
            console.error('加载提示词失败:', error);
            throw error;
        }
    }

    async savePrompt(prompt, projectId = null) {
        const targetProjectId = projectId || this.currentProject?.id;
        if (!targetProjectId) return;

        try {
            await fetch(`/api/prompts/${targetProjectId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ prompt })
            });
        } catch (error) {
            console.error('保存提示词失败:', error);
            throw error;
        }
    }

    async moveProjectUp(projectId) {
        try {
            const response = await fetch(`/api/projects/${projectId}/move-up`, {
                method: 'PUT'
            });

            if (response.ok) {
                const updatedProjects = await response.json();
                this.projects = updatedProjects;
                return updatedProjects;
            } else {
                throw new Error('项目上移失败');
            }
        } catch (error) {
            console.error('项目上移失败:', error);
            throw error;
        }
    }

    async moveProjectDown(projectId) {
        try {
            const response = await fetch(`/api/projects/${projectId}/move-down`, {
                method: 'PUT'
            });

            if (response.ok) {
                const updatedProjects = await response.json();
                this.projects = updatedProjects;
                return updatedProjects;
            } else {
                throw new Error('项目下移失败');
            }
        } catch (error) {
            console.error('项目下移失败:', error);
            throw error;
        }
    }

    restoreLastSelectedProject() {
        const activeProjectId = localStorage.getItem('activeProjectId');
        if (activeProjectId && this.projects.length > 0) {
            const targetProject = this.projects.find(p => p.id === activeProjectId);
            return targetProject || this.projects[0];
        }
        return this.projects.length > 0 ? this.projects[0] : null;
    }
}