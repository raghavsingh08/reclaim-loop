import api from './api';

export const getNotifications = async () => {
  const response = await api.get('/notifications');
  return response.data?.data || response.data;
};

export const markNotificationAsRead = async (notificationId) => {
  const response = await api.patch(`/notifications/${notificationId}/read`);
  return response.data?.data || response.data;
};

export const markAllNotificationsAsRead = async () => {
  const response = await api.patch('/notifications/read-all');
  return response.data?.data || response.data;
};
