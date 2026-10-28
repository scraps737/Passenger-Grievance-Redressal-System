import { Notification } from '../models/Notification.js';
import { NOTIFICATION_TYPES } from '../config/constants.js';

export async function notify({
  user,
  title,
  body = '',
  type = NOTIFICATION_TYPES.SYSTEM,
  grievance = null,
  referenceId = '',
  link = '',
  priority = 'normal',
}) {
  if (!user) return null;
  return Notification.create({ user, title, body, type, grievance, referenceId, link, priority });
}

export async function notifyMany(users, payload) {
  return Promise.all(users.filter(Boolean).map((user) => notify({ ...payload, user })));
}

export async function listNotifications(userId, { page = 1, limit = 20, unreadOnly = false } = {}) {
  const filter = { user: userId };
  if (unreadOnly) filter.read = false;
  const skip = (page - 1) * limit;
  const [items, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: userId, read: false }),
  ]);
  return { items, total, unread, page, limit, pages: Math.ceil(total / limit) || 1 };
}

export async function markRead(userId, notificationId) {
  return Notification.findOneAndUpdate(
    { _id: notificationId, user: userId },
    { read: true, readAt: new Date() },
    { new: true }
  );
}

export async function markAllRead(userId) {
  return Notification.updateMany({ user: userId, read: false }, { read: true, readAt: new Date() });
}
