import api from './api';

export const getNotifications = async ({ cursor, limit } = {}) => {
  const response = await api.get('/notifications', {
    params: {
      ...(cursor && { cursor }),
      ...(limit !== undefined && { limit }),
    },
  });
  return response.data?.data || response.data;
};

export const getUnreadNotificationCount = async () => {
  const response = await api.get('/notifications/unread-count');
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
