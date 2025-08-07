class FavoriteManager {
    constructor() {
        this.favorites = [];
        this.currentFavoriteId = null;
    }

    async loadFavorites() {
        try {
            const response = await fetch('/api/favorites');
            this.favorites = await response.json();
            return this.favorites;
        } catch (error) {
            console.error('加载收藏列表失败:', error);
            throw error;
        }
    }

    getCurrentProjectFavorites(projectId) {
        if (!projectId) return [];
        return this.favorites.filter(favorite => favorite.projectId === projectId);
    }

    async saveFavorite(favoriteData) {
        const { name, description, content, projectId } = favoriteData;

        if (!name || !name.trim()) {
            throw new Error('请输入收藏名称');
        }

        try {
            const response = await fetch('/api/favorites', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name.trim(),
                    description: description.trim(),
                    content: content.trim(),
                    projectId
                })
            });

            if (response.ok) {
                const favorite = await response.json();
                this.favorites.push(favorite);
                return favorite;
            } else {
                throw new Error('保存收藏失败');
            }
        } catch (error) {
            console.error('保存收藏失败:', error);
            throw error;
        }
    }

    async deleteFavorite(favoriteId) {
        try {
            const response = await fetch(`/api/favorites/${favoriteId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.favorites = this.favorites.filter(f => f.id !== favoriteId);
                return true;
            } else {
                throw new Error('删除收藏失败');
            }
        } catch (error) {
            console.error('删除收藏失败:', error);
            throw error;
        }
    }

    findFavoriteById(favoriteId) {
        return this.favorites.find(f => f.id === favoriteId);
    }

    checkCurrentFavorite(content, projectId) {
        if (!projectId) {
            this.currentFavoriteId = null;
            return null;
        }

        const currentProjectFavorites = this.getCurrentProjectFavorites(projectId);
        const existingFavorite = currentProjectFavorites.find(f => f.content === content);

        if (existingFavorite) {
            this.currentFavoriteId = existingFavorite.id;
            return existingFavorite;
        } else {
            this.currentFavoriteId = null;
            return null;
        }
    }

    generateSuggestedName(content) {
        const lines = content.split('\n').filter(line => line.trim());
        if (lines.length > 0) {
            const firstLine = lines[0].trim();
            return firstLine.length > 30 ? firstLine.substring(0, 30) + '...' : firstLine;
        }
        return '';
    }

    validateFavoriteForProject(favoriteId, projectId) {
        const favorite = this.findFavoriteById(favoriteId);
        if (!favorite) {
            throw new Error('收藏不存在');
        }

        if (favorite.projectId !== projectId) {
            throw new Error('该收藏不属于当前项目');
        }

        return favorite;
    }

    isCurrentFavorite(favoriteId) {
        return this.currentFavoriteId === favoriteId;
    }

    clearCurrentFavorite() {
        this.currentFavoriteId = null;
    }

    setCurrentFavorite(favoriteId) {
        this.currentFavoriteId = favoriteId;
    }
}