import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';

const DASHBOARD_EVENTS = Object.freeze({
  CUSTOMER: ['case:updated'],
  ADMIN: ['case:updated'],
  COURIER: [
    'case:updated',
    'pickup:assigned',
    'pickup:accepted',
    'pickup:collected',
  ],
  INSPECTOR: [
    'inspection:assigned',
    'inspection:started',
    'inspection:completed',
  ],
});

export function useDashboardRealtime(
  onDashboardUpdated,
  { debounceMs = 200 } = {},
) {
  const socket = useSocket();
  const { user } = useAuth();
  const callbackRef = useRef(onDashboardUpdated);

  useEffect(() => {
    callbackRef.current = onDashboardUpdated;
  }, [onDashboardUpdated]);

  useEffect(() => {
    const events = DASHBOARD_EVENTS[user?.role] || [];
    if (!socket || events.length === 0) return undefined;

    let active = true;
    let debounceTimer;

    const scheduleRefetch = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (!active || typeof callbackRef.current !== 'function') return;
        Promise.resolve(callbackRef.current()).catch((error) => {
          console.error('Dashboard real-time refetch failed:', error);
        });
      }, debounceMs);
    };

    const handleConnect = () => {
      scheduleRefetch();
    };

    const handlers = {};

    for (const eventName of events) {
      handlers[eventName] = () => {
        scheduleRefetch();
      };
      socket.on(eventName, handlers[eventName]);
    }
    socket.on('connect', handleConnect);

    return () => {
      active = false;
      clearTimeout(debounceTimer);
      for (const eventName of events) {
        if (handlers[eventName]) {
          socket.off(eventName, handlers[eventName]);
        }
      }
      socket.off('connect', handleConnect);
    };
  }, [debounceMs, socket, user?.role]);
}
