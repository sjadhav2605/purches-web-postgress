import { NotificationService } from './notification.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';

export const NotificationController = {
  async getAll(req, res, next) {
    try {
      const { limit = 50 } = req.query;
      const result = await NotificationService.getNotificationsForUser(req.user, limit);
      return ApiResponse.success(res, result, 'Notifications retrieved');
    } catch (err) {
      next(err);
    }
  },

  async getUnreadCount(req, res, next) {
    try {
      const result = await NotificationService.getNotificationsForUser(req.user, 1);
      return ApiResponse.success(res, { unreadCount: result.unreadCount }, 'Unread count retrieved');
    } catch (err) {
      next(err);
    }
  },

  async markAsRead(req, res, next) {
    try {
      const { id } = req.params;
      await NotificationService.markAsRead(Number(id));
      return ApiResponse.success(res, { success: true }, 'Notification marked as read');
    } catch (err) {
      next(err);
    }
  },

  async markAllAsRead(req, res, next) {
    try {
      await NotificationService.markAllAsRead(req.user);
      return ApiResponse.success(res, { success: true }, 'All notifications marked as read');
    } catch (err) {
      next(err);
    }
  }
};
