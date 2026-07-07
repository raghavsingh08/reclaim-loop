import { useEffect, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';

export function useNotificationsRealtime(
  onNotificationReceived,
  { debounceMs = 200 } = {},
) {
  const socket = useSocket();
  const callbackRef = useRef(onNotificationReceived);

  useEffect(() => {
    callbackRef.current = onNotificationReceived;
  }, [onNotificationReceived]);

  useEffect(() => {
    if (!socket) return undefined;

    let active = true;
    let debounceTimer;
    let latestNotification;

    const scheduleRefetch = (notification) => {
      latestNotification = notification || null;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (!active || typeof callbackRef.current !== 'function') return;
        Promise.resolve(callbackRef.current(latestNotification)).catch((error) => {
          console.error('Notification real-time refetch failed:', error);
        });
      }, debounceMs);
    };

    const handleNotification = (notification) => scheduleRefetch(notification);
    const handleConnect = () => scheduleRefetch();

    socket.on('notification:new', handleNotification);
    socket.on('connect', handleConnect);

    return () => {
      active = false;
      clearTimeout(debounceTimer);
      socket.off('notification:new', handleNotification);
      socket.off('connect', handleConnect);
    };
  }, [debounceMs, socket]);
}
