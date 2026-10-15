import api from './api.js';

export const notificationService = {
  async getNotifications(params = {}) {
    const res = await api.get('/notifications', { params });
    // Normalize response from axios interceptor
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.items)) return res.items;
    if (Array.isArray(res?.data?.items)) return res.data.items;
    if (Array.isArray(res?.data)) return res.data;
    return [];
  },

  async getUnreadCount() {
    const res = await api.get('/notifications/unread-count');
    return res?.data?.unreadCount ?? res?.unreadCount ?? (typeof res === 'number' ? res : 0);
  },

  async markAsRead(id) {
    const res = await api.patch(`/notifications/${id}/read`);
    return res.data;
  },

  async markAllAsRead() {
    const res = await api.post('/notifications/mark-all-read');
    return res.data;
  }
};

export default notificationService;
