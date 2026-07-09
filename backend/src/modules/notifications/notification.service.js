import mongoose from 'mongoose';
import { logger as rootLogger } from '../../config/logger.js';
import { USER_ROLES } from '../../constants/roles.js';
import { EventPublisher } from '../../domain/eventPublisher.js';
import { Outbox } from '../../domain/outbox.js';
import { Notification } from '../../models/Notification.js';
import { User } from '../../models/User.js';
import { ApiError } from '../../utils/ApiError.js';

const DEFAULT_NOTIFICATION_LIMIT = 25;
const MAX_NOTIFICATION_LIMIT = 100;
const NOTIFICATION_CURSOR_VERSION = 1;

const parseNotificationLimit = (value) => {
  if (value === undefined) return DEFAULT_NOTIFICATION_LIMIT;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new ApiError(400, 'Notification limit must be an integer between 1 and 100');
  }

  const limit = Number(value);
  if (limit < 1 || limit > MAX_NOTIFICATION_LIMIT) {
    throw new ApiError(400, 'Notification limit must be an integer between 1 and 100');
  }
  return limit;
};

const encodeNotificationCursor = ({ createdAt, _id }) => Buffer.from(JSON.stringify({
  v: NOTIFICATION_CURSOR_VERSION,
  createdAt: createdAt.toISOString(),
  id: _id.toString(),
})).toString('base64url');

const decodeNotificationCursor = (value) => {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    !/^[A-Za-z0-9_-]+$/.test(value)
  ) {
    throw new ApiError(400, 'Invalid notification cursor');
  }

  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    const createdAt = new Date(decoded.createdAt);
    if (
      decoded.v !== NOTIFICATION_CURSOR_VERSION ||
      typeof decoded.createdAt !== 'string' ||
      Number.isNaN(createdAt.getTime()) ||
      typeof decoded.id !== 'string' ||
      !mongoose.isValidObjectId(decoded.id)
    ) {
      throw new Error('Invalid cursor payload');
    }
    return { createdAt, id: new mongoose.Types.ObjectId(decoded.id) };
  } catch {
    throw new ApiError(400, 'Invalid notification cursor');
  }
};

export const createNotification = async ({
  userId,
  caseId,
  type,
  title,
  message,
  metadata = {},
  session,
  commandId,
  logger,
}) => {
  const notificationLogger = (
    typeof logger?.child === 'function' ? logger : rootLogger
  ).child({ component: 'notification-service' });
  const safeContext = {
    recipientId: userId?.toString(),
    ...(caseId && { caseId: caseId.toString() }),
    type,
  };

  let notification;
  try {
    const notificationDocument = {
      userId,
      caseId,
      type,
      title,
      message,
      metadata,
    };
    if (session) {
      [notification] = await Notification.create(
        [notificationDocument],
        { session },
      );
    } else {
      notification = await Notification.create(notificationDocument);
    }
  } catch (error) {
    notificationLogger.warn(
      {
        ...safeContext,
        outcome: 'notification_persistence_failed',
        deliveryStage: 'persistence',
        errorType: error?.name || 'Error',
        ...(error?.code && { errorCode: error.code }),
      },
      'Notification persistence failed',
    );
    throw error;
  }

  const persistedContext = {
    notificationId: notification._id.toString(),
    recipientId: notification.userId.toString(),
    ...(notification.caseId && { caseId: notification.caseId.toString() }),
    type: notification.type,
  };
  notificationLogger.debug(
    {
      ...persistedContext,
      outcome: 'notification_persisted',
      deliveryStage: 'persistence',
    },
    'Notification persisted',
  );

  if (session) {
    await Outbox.enqueue({
      session,
      type: 'NOTIFICATION_NEW',
      aggregateType: 'Notification',
      aggregateId: notification._id,
      commandId,
      deduplicationKey: `${notification._id}:NOTIFICATION_NEW`,
      payload: {
        notificationId: notification._id.toString(),
        recipientId: notification.userId.toString(),
        type: notification.type,
        title: notification.title,
        message: notification.message,
        relatedCaseId: notification.caseId?.toString(),
        createdAt: notification.createdAt,
      },
      logger,
    });
    return notification;
  }

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
    notificationLogger.debug(
      {
        ...persistedContext,
        outcome: 'notification_socket_publish_attempted',
        deliveryStage: 'socket',
      },
      'Notification socket publication attempted',
    );
  } catch (error) {
    // Notification persistence already succeeded; real-time delivery is best effort.
    notificationLogger.warn(
      {
        ...persistedContext,
        outcome: 'notification_socket_publish_failed',
        deliveryStage: 'socket',
        errorType: error?.name || 'Error',
        ...(error?.code && { errorCode: error.code }),
      },
      'Notification socket publication failed',
    );
  }

  return notification;
};

export const createAdminNotifications = async (notification, options = {}) => {
  const normalizedOptions = typeof options?.child === 'function'
    ? { logger: options }
    : options;
  const { session, commandId, logger } = normalizedOptions;
  const adminQuery = User.find({ role: USER_ROLES.ADMIN, isActive: true }).select('_id').lean();
  if (session) adminQuery.session(session);
  const admins = await adminQuery;
  const createForAdmin = ({ _id }) => createNotification({
      ...notification,
      userId: _id,
      session,
      commandId,
      logger,
    });

  if (!session) return Promise.all(admins.map(createForAdmin));

  const notifications = [];
  for (const admin of admins) {
    notifications.push(await createForAdmin(admin));
  }
  return notifications;
};

export const getMyNotifications = async (userId, { limit: rawLimit, cursor: rawCursor } = {}) => {
  const limit = parseNotificationLimit(rawLimit);
  const filter = { userId };

  if (rawCursor !== undefined) {
    const cursor = decodeNotificationCursor(rawCursor);
    filter.$or = [
      { createdAt: { $lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
    ];
  }

  const results = await Notification.find(filter)
    .select('_id userId caseId type title message metadata isRead createdAt updatedAt')
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();
  const hasNextPage = results.length > limit;
  const notifications = hasNextPage ? results.slice(0, limit) : results;
  const lastNotification = notifications.at(-1);

  return {
    notifications,
    pageInfo: {
      nextCursor: hasNextPage && lastNotification
        ? encodeNotificationCursor(lastNotification)
        : null,
      hasNextPage,
    },
  };
};

export const getUnreadNotificationCount = (userId) =>
  Notification.countDocuments({ userId, isRead: false });

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
