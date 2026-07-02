import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './notification.service.js';

export const list = asyncHandler(async (req, res) => {
  const notifications = await getMyNotifications(req.user._id);
  res.status(200).json(new ApiResponse(200, { notifications }, 'Notifications retrieved'));
});

export const markRead = asyncHandler(async (req, res) => {
  const notification = await markNotificationRead(req.params.notificationId, req.user._id);
  res.status(200).json(new ApiResponse(200, { notification }, 'Notification marked as read'));
});

export const markAllRead = asyncHandler(async (req, res) => {
  const result = await markAllNotificationsRead(req.user._id);
  res.status(200).json(new ApiResponse(200, result, 'All notifications marked as read'));
});
