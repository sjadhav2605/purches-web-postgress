import { Router } from 'express';
import { NotificationController } from './notification.controller.js';
import { verifyJwt } from '../../middlewares/auth.middleware.js';

const router = Router();
router.use(verifyJwt);

router.get('/', NotificationController.getAll);
router.get('/unread-count', NotificationController.getUnreadCount);
router.post('/mark-all-read', NotificationController.markAllAsRead);
router.patch('/mark-all-read', NotificationController.markAllAsRead);
router.patch('/read-all', NotificationController.markAllAsRead);
router.patch('/:id/read', NotificationController.markAsRead);

export default router;
