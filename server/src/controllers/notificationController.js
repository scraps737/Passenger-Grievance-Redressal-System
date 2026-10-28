import { asyncHandler, ApiError } from '../utils/ApiError.js';
import { listNotifications, markAllRead, markRead } from '../services/notificationService.js';

export const getNotifications = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Number.parseInt(req.query.limit, 10) || 20);
  const unreadOnly = req.query.unread === 'true';
  const result = await listNotifications(req.user._id, { page, limit, unreadOnly });
  res.json({ success: true, ...result });
});

export const readNotification = asyncHandler(async (req, res) => {
  const notification = await markRead(req.user._id, req.params.id);
  if (!notification) throw ApiError.notFound('Notification not found');
  res.json({ success: true, notification });
});

export const readAllNotifications = asyncHandler(async (req, res) => {
  await markAllRead(req.user._id);
  res.json({ success: true });
});
