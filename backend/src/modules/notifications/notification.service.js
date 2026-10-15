import { NotificationModel } from './notification.model.js';

export const NotificationService = {
  async getNotificationsForUser(currentUser, limit = 50) {
    const userId = currentUser.id;
    const vendorId = currentUser.vendor_id || (currentUser.role === 'vendor' ? currentUser.id : null);
    const role = currentUser.activeRole || currentUser.role;
    const isAdmin = currentUser.role === 'admin';

    const items = await NotificationModel.findAllForUser({ userId, vendorId, role, isAdmin, limit });
    const unreadCount = await NotificationModel.getUnreadCount({ userId, vendorId, role, isAdmin });

    return {
      items,
      unreadCount
    };
  },

  async markAsRead(id) {
    return await NotificationModel.markAsRead(id);
  },

  async markAllAsRead(currentUser) {
    const userId = currentUser.id;
    return await NotificationModel.markAllAsRead({ userId });
  }
};
