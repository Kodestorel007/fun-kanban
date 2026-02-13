/**
 * API Client — handles all HTTP communication with the FastAPI backend.
 * Token refresh, error handling, and every endpoint in one place.
 */
const API_BASE = '/api';

class ApiClient {
  constructor() {
    this.accessToken = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
  }

  setTokens(accessToken, refreshToken) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = { 'Content-Type': 'application/json', ...options.headers };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    let response = await fetch(url, { ...options, headers });

    // 401 → try refresh
    if (response.status === 401 && this.refreshToken) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        response = await fetch(url, { ...options, headers });
      }
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(err.detail || 'Request failed');
    }

    return response.json();
  }

  async refreshAccessToken() {
    try {
      const resp = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: this.refreshToken }),
      });
      if (resp.ok) {
        const data = await resp.json();
        this.setTokens(data.access_token, data.refresh_token);
        return true;
      }
    } catch (e) {
      console.error('Token refresh failed:', e);
    }
    this.clearTokens();
    return false;
  }

  // ─── Auth ──────────────────────────────────────────────
  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setTokens(data.access_token, data.refresh_token);
    return data;
  }

  async register(email, password) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setTokens(data.access_token, data.refresh_token);
    return data;
  }

  async logout() {
    try { await this.request('/auth/logout', { method: 'POST' }); }
    finally { this.clearTokens(); }
  }

  async getMe() { return this.request('/auth/me'); }

  async updateMe(data) {
    return this.request('/users/me', { method: 'PUT', body: JSON.stringify(data) });
  }

  // ─── Workspaces ────────────────────────────────────────
  async getWorkspaces() { return this.request('/workspaces'); }

  async createWorkspace(data) {
    return this.request('/workspaces', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateWorkspace(id, data) {
    return this.request(`/workspaces/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteWorkspace(id) {
    return this.request(`/workspaces/${id}`, { method: 'DELETE' });
  }

  async reorderWorkspaces(workspaceIds) {
    return this.request('/workspaces/reorder', { method: 'PUT', body: JSON.stringify(workspaceIds) });
  }

  async getWorkspaceMembers(wsId) { return this.request(`/workspaces/${wsId}/members`); }

  async addWorkspaceMember(wsId, userId, role) {
    return this.request(`/workspaces/${wsId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, role }),
    });
  }

  async removeWorkspaceMember(wsId, memberId) {
    return this.request(`/workspaces/${wsId}/members/${memberId}`, { method: 'DELETE' });
  }

  async updateMemberRole(wsId, memberId, role) {
    return this.request(`/workspaces/${wsId}/members/${memberId}?role=${role}`, { method: 'PUT' });
  }

  // ─── Projects ──────────────────────────────────────────
  async getProjects(wsId) { return this.request(`/workspaces/${wsId}/projects`); }

  async createProject(data) {
    return this.request('/projects', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateProject(id, data) {
    return this.request(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteProject(id) {
    return this.request(`/projects/${id}`, { method: 'DELETE' });
  }

  // ─── Tasks ─────────────────────────────────────────────
  async getTasks(wsId) { return this.request(`/workspaces/${wsId}/tasks`); }

  async createTask(data) {
    return this.request('/tasks', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateTask(id, data) {
    return this.request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteTask(id) {
    return this.request(`/tasks/${id}`, { method: 'DELETE' });
  }

  async addTaskUpdate(taskId, content) {
    return this.request(`/tasks/${taskId}/updates`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async deleteTaskUpdate(taskId, updateId) {
    return this.request(`/tasks/${taskId}/updates/${updateId}`, { method: 'DELETE' });
  }

  // ─── Admin ─────────────────────────────────────────────
  async getAdminStats() { return this.request('/admin/stats'); }
  async getAdminUsers() { return this.request('/admin/users'); }

  async createUser(data) {
    return this.request('/admin/users', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateUser(id, data) {
    return this.request(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async resetUserPassword(id, newPassword) {
    return this.request(`/admin/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ new_password: newPassword }),
    });
  }

  async deleteUser(id) {
    return this.request(`/admin/users/${id}`, { method: 'DELETE' });
  }

  async getAdminWorkspaces() { return this.request('/admin/workspaces'); }

  async getActivityLog(limit = 100) {
    return this.request(`/admin/activity?limit=${limit}`);
  }

  // ─── Settings ──────────────────────────────────────────
  async getSMTPSettings() { return this.request('/admin/settings/smtp'); }

  async updateSMTPSettings(settings) {
    return this.request('/admin/settings/smtp', { method: 'PUT', body: JSON.stringify(settings) });
  }

  async testSMTP() {
    return this.request('/admin/settings/smtp/test', { method: 'POST' });
  }

  async getAppSettings() { return this.request('/admin/settings/app'); }

  async updateAppSettings(settings) {
    return this.request('/admin/settings/app', { method: 'PUT', body: JSON.stringify(settings) });
  }

  // ─── Notifications ─────────────────────────────────────
  async getNotifications(limit = 50) { return this.request(`/notifications?limit=${limit}`); }
  async getNotificationCount() { return this.request('/notifications/count'); }

  async markNotificationsRead() {
    return this.request('/notifications/mark-read', { method: 'POST' });
  }

  async deleteNotification(id) {
    return this.request(`/notifications/${id}`, { method: 'DELETE' });
  }

  async cleanupNotifications() {
    return this.request('/notifications/cleanup', { method: 'POST' });
  }

  // ─── Password Reset (no auth) ─────────────────────────
  async forgotPassword(email) {
    const resp = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return resp.json();
  }

  async resetPassword(token, newPassword) {
    const resp = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password: newPassword }),
    });
    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.detail || 'Reset failed');
    }
    return resp.json();
  }

  // ─── Features ──────────────────────────────────────────
  async getFeatures() {
    const resp = await fetch(`${API_BASE}/features`);
    if (!resp.ok) throw new Error('Failed to fetch features');
    return resp.json();
  }
}

export const api = new ApiClient();
export default api;
