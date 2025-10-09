/**
 * Claude 代理管理器
 * 负责管理 Claude API 代理配置
 */
class ClaudeProxyManager {
  constructor(uiUtils) {
    this.uiUtils = uiUtils;
    this.proxies = [];
    this.activeProxyId = null;
  }

  /**
   * 加载代理配置列表
   */
  async loadProxies() {
    try {
      const response = await fetch('/api/claude-proxies');
      const data = await response.json();
      this.proxies = data.proxies || [];
      this.activeProxyId = data.activeProxyId;
      this.renderProxyList();
      this.updateNavbarDisplay();
    } catch (error) {
      console.error('加载代理配置失败:', error);
      UIUtils.showMessage('加载代理配置失败', 'error');
    }
  }

  /**
   * 渲染代理列表
   */
  renderProxyList() {
    const container = document.getElementById('claudeProxyList');
    if (!container) return;

    if (this.proxies.length === 0) {
      container.innerHTML = '<div class="text-muted text-center py-3">暂无代理配置</div>';
      return;
    }

    container.innerHTML = this.proxies.map((proxy, index) => `
      <div class="proxy-item ${proxy.id === this.activeProxyId ? 'active' : ''}" data-proxy-id="${proxy.id}">
        <div class="proxy-info">
          <div class="proxy-name">
            ${this.uiUtils.escapeHtml(proxy.name)}
            ${proxy.id === this.activeProxyId ? '<span class="proxy-active-badge">当前激活</span>' : ''}
          </div>
          <div class="proxy-url">${this.uiUtils.escapeHtml(proxy.url)}</div>
        </div>
        <div class="proxy-actions">
          <button class="btn btn-sm btn-outline-secondary move-up-proxy" data-proxy-id="${proxy.id}" ${index === 0 ? 'disabled' : ''} title="上移">
            <span class="btn-icon">↑</span>
          </button>
          <button class="btn btn-sm btn-outline-secondary move-down-proxy" data-proxy-id="${proxy.id}" ${index === this.proxies.length - 1 ? 'disabled' : ''} title="下移">
            <span class="btn-icon">↓</span>
          </button>
          <button class="btn btn-sm btn-outline-success copy-proxy" data-proxy-id="${proxy.id}" title="复制">
            <span class="btn-text">复制</span>
          </button>
          <button class="btn btn-sm btn-outline-primary edit-proxy" data-proxy-id="${proxy.id}" title="编辑">
            <span class="btn-text">编辑</span>
          </button>
          <button class="btn btn-sm btn-outline-danger delete-proxy" data-proxy-id="${proxy.id}" title="删除">
            <span class="btn-text">删除</span>
          </button>
        </div>
      </div>
    `).join('');

    this.attachProxyListEvents();
  }

  /**
   * 附加代理列表事件
   */
  attachProxyListEvents() {
    // 点击代理项激活代理
    document.querySelectorAll('.proxy-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // 如果点击的是按钮或按钮内的元素,不处理激活
        if (e.target.closest('.proxy-actions button')) {
          return;
        }

        const proxyId = item.dataset.proxyId;
        if (proxyId !== this.activeProxyId) {
          this.activateProxy(proxyId);
        }
      });
    });

    // 上移代理
    document.querySelectorAll('.move-up-proxy').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const proxyId = e.currentTarget.dataset.proxyId;
        this.moveProxy(proxyId, 'up');
      });
    });

    // 下移代理
    document.querySelectorAll('.move-down-proxy').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const proxyId = e.currentTarget.dataset.proxyId;
        this.moveProxy(proxyId, 'down');
      });
    });

    // 复制代理
    document.querySelectorAll('.copy-proxy').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const proxyId = e.currentTarget.dataset.proxyId;
        this.copyProxy(proxyId);
      });
    });

    // 编辑代理
    document.querySelectorAll('.edit-proxy').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const proxyId = e.currentTarget.dataset.proxyId;
        this.editProxy(proxyId);
      });
    });

    // 删除代理
    document.querySelectorAll('.delete-proxy').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const proxyId = e.currentTarget.dataset.proxyId;
        this.deleteProxy(proxyId);
      });
    });
  }

  /**
   * 显示添加代理对话框
   */
  showAddProxyDialog() {
    const modal = new bootstrap.Modal(document.getElementById('claudeProxyModal'));
    document.getElementById('claudeProxyModalLabel').textContent = '添加 Claude 代理';
    document.getElementById('proxyId').value = '';
    document.getElementById('proxyName').value = '';
    document.getElementById('proxyUrl').value = '';
    document.getElementById('proxyToken').value = '';
    modal.show();
  }

  /**
   * 编辑代理
   */
  editProxy(proxyId) {
    const proxy = this.proxies.find(p => p.id === proxyId);
    if (!proxy) return;

    const modal = new bootstrap.Modal(document.getElementById('claudeProxyModal'));
    document.getElementById('claudeProxyModalLabel').textContent = '编辑 Claude 代理';
    document.getElementById('proxyId').value = proxy.id;
    document.getElementById('proxyName').value = proxy.name;
    document.getElementById('proxyUrl').value = proxy.url;
    document.getElementById('proxyToken').value = proxy.token;
    modal.show();
  }

  /**
   * 保存代理配置
   */
  async saveProxy() {
    const proxyId = document.getElementById('proxyId').value;
    const name = document.getElementById('proxyName').value.trim();
    const url = document.getElementById('proxyUrl').value.trim();
    const token = document.getElementById('proxyToken').value.trim();

    if (!name || !url || !token) {
      UIUtils.showMessage('请填写所有必填字段', 'warning');
      return;
    }

    try {
      let response;
      if (proxyId) {
        // 更新现有代理
        response = await fetch(`/api/claude-proxies/${proxyId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, url, token })
        });
      } else {
        // 添加新代理
        response = await fetch('/api/claude-proxies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, url, token })
        });
      }

      if (response.ok) {
        UIUtils.showMessage(proxyId ? '代理配置已更新' : '代理配置已添加', 'success');
        await this.loadProxies();

        // 关闭模态框
        const modalEl = document.getElementById('claudeProxyModal');
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (modalInstance) {
          modalInstance.hide();
        }
      } else {
        const error = await response.json();
        UIUtils.showMessage(error.error || '保存失败', 'error');
      }
    } catch (error) {
      console.error('保存代理配置失败:', error);
      UIUtils.showMessage('保存代理配置失败', 'error');
    }
  }

  /**
   * 激活代理
   */
  async activateProxy(proxyId) {
    try {
      const proxy = this.proxies.find(p => p.id === proxyId);
      const proxyName = proxy ? proxy.name : '代理';

      const response = await fetch(`/api/claude-proxies/${proxyId}/activate`, {
        method: 'PUT'
      });

      if (response.ok) {
        UIUtils.showMessage(`已激活代理: ${proxyName}`, 'success');
        await this.loadProxies();

        // 更新首页显示
        this.updateNavbarDisplay();
      } else {
        const error = await response.json();
        UIUtils.showMessage(error.error || '激活失败', 'error');
      }
    } catch (error) {
      console.error('激活代理失败:', error);
      UIUtils.showMessage('激活代理失败', 'error');
    }
  }

  /**
   * 更新导航栏显示
   */
  updateNavbarDisplay() {
    const activeProxy = this.proxies.find(p => p.id === this.activeProxyId);
    const settingsBtn = document.querySelector('[data-bs-target="#claudeProxySettingsModal"]');

    if (settingsBtn && activeProxy) {
      settingsBtn.innerHTML = `Claude 代理设置 <span class="badge bg-success ms-1">${this.uiUtils.escapeHtml(activeProxy.name)}</span>`;
    } else if (settingsBtn) {
      settingsBtn.textContent = 'Claude 代理设置';
    }
  }

  /**
   * 删除代理
   */
  async deleteProxy(proxyId) {
    const proxy = this.proxies.find(p => p.id === proxyId);
    const proxyName = proxy ? proxy.name : '此代理';

    if (!confirm(`确定要删除代理 "${proxyName}" 吗?`)) return;

    try {
      const response = await fetch(`/api/claude-proxies/${proxyId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        UIUtils.showMessage('代理配置已删除', 'success');
        await this.loadProxies();
      } else {
        const error = await response.json();
        UIUtils.showMessage(error.error || '删除失败', 'error');
      }
    } catch (error) {
      console.error('删除代理失败:', error);
      UIUtils.showMessage('删除代理失败', 'error');
    }
  }

  /**
   * 移动代理位置
   */
  async moveProxy(proxyId, direction) {
    try {
      const response = await fetch(`/api/claude-proxies/${proxyId}/move-${direction}`, {
        method: 'PUT'
      });

      if (response.ok) {
        await this.loadProxies();
      } else {
        const error = await response.json();
        UIUtils.showMessage(error.error || '移动失败', 'error');
      }
    } catch (error) {
      console.error('移动代理失败:', error);
      UIUtils.showMessage('移动代理失败', 'error');
    }
  }

  /**
   * 复制代理
   */
  async copyProxy(proxyId) {
    try {
      const proxy = this.proxies.find(p => p.id === proxyId);
      const proxyName = proxy ? proxy.name : '代理';

      const response = await fetch(`/api/claude-proxies/${proxyId}/copy`, {
        method: 'POST'
      });

      if (response.ok) {
        UIUtils.showMessage(`已复制代理: ${proxyName}`, 'success');
        await this.loadProxies();
      } else {
        const error = await response.json();
        UIUtils.showMessage(error.error || '复制失败', 'error');
      }
    } catch (error) {
      console.error('复制代理失败:', error);
      UIUtils.showMessage('复制代理失败', 'error');
    }
  }
}
