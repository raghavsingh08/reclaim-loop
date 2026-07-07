import { useEffect, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';

const DEFAULT_DEBOUNCE_MS = 200;

export function useCaseRealtime(
  caseId,
  onCaseUpdated,
  { debounceMs = DEFAULT_DEBOUNCE_MS } = {},
) {
  const socket = useSocket();
  const callbackRef = useRef(onCaseUpdated);

  useEffect(() => {
    callbackRef.current = onCaseUpdated;
  }, [onCaseUpdated]);

  useEffect(() => {
    if (!socket || !caseId) return undefined;

    let active = true;
    let debounceTimer;

    const scheduleRefetch = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (!active || typeof callbackRef.current !== 'function') return;
        Promise.resolve(callbackRef.current()).catch((error) => {
          console.error('Case real-time refetch failed:', error);
        });
      }, debounceMs);
    };

    const joinCase = ({ refetch = false } = {}) => {
      socket.emit('join-case', { caseId }, (result) => {
        if (!active) return;
        if (!result?.success) {
          console.warn('Unable to join case room:', result?.message || 'Access denied');
          return;
        }
        if (refetch) scheduleRefetch();
      });
    };

    const handleCaseUpdated = (event) => {
      if (event?.caseId?.toString() === caseId.toString()) scheduleRefetch();
    };

    const handleConnect = () => joinCase({ refetch: true });

    socket.on('case:updated', handleCaseUpdated);
    socket.on('connect', handleConnect);

    if (socket.connected) joinCase();

    return () => {
      active = false;
      clearTimeout(debounceTimer);
      socket.off('case:updated', handleCaseUpdated);
      socket.off('connect', handleConnect);
      if (socket.connected) socket.emit('leave-case', { caseId });
    };
  }, [caseId, debounceMs, socket]);
}
