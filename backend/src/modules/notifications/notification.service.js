import mongoose from 'mongoose';
import { USER_ROLES } from '../../constants/roles.js';
import { EventPublisher } from '../../domain/eventPublisher.js';
import { Notification } from '../../models/Notification.js';
import { User } from '../../models/User.js';
import { ApiError } from '../../utils/ApiError.js';

export const createNotification = async ({
  userId,
  caseId,
  type,
  title,
  message,
  metadata = {},
}) => {
  const notification = await Notification.create({
    userId,
    caseId,
    type,
    title,
    message,
    metadata,
  });

  try {
    EventPublisher.publishNotificationNew({
      notificationId: notification._id.toString(),
      recipientId: notification.userId.toString(),
      type: notification.type,
      title: notification.title,
      message: notification.message,
      relatedCaseId: notification.caseId?.toString(),
      createdAt: notification.createdAt,
    });
  } catch (error) {
    // Notification persistence already succeeded; real-time delivery is best effort.
    console.error('Notification socket emission failed:', error);
  }

  return notification;
};

export const createAdminNotifications = async (notification) => {
  const admins = await User.find({ role: USER_ROLES.ADMIN, isActive: true }).select('_id');
  return Promise.all(
    admins.map(({ _id }) => createNotification({ ...notification, userId: _id })),
  );
};

export const getMyNotifications = (userId) =>
  Notification.find({ userId }).sort({ createdAt: -1 });

export const markNotificationRead = async (notificationId, userId) => {
  if (!mongoose.isValidObjectId(notificationId)) {
    throw new ApiError(400, 'Invalid notification ID');
  }
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { $set: { isRead: true } },
    { new: true },
  );
  if (!notification) throw new ApiError(404, 'Notification not found');
  return notification;
};

export const markAllNotificationsRead = async (userId) => {
  const result = await Notification.updateMany(
    { userId, isRead: false },
    { $set: { isRead: true } },
  );
  return { modifiedCount: result.modifiedCount };
};
