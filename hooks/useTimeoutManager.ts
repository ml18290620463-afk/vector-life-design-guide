import { useCallback, useEffect, useRef } from 'react';

export const useTimeoutManager = () => {
  const timeoutIdsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearScheduledTimeouts = useCallback(() => {
    timeoutIdsRef.current.forEach(clearTimeout);
    timeoutIdsRef.current = [];
  }, []);

  const scheduleTimeout = useCallback((callback: () => void, delay: number) => {
    const timeoutId = setTimeout(() => {
      timeoutIdsRef.current = timeoutIdsRef.current.filter((id) => id !== timeoutId);
      callback();
    }, delay);

    timeoutIdsRef.current.push(timeoutId);
    return timeoutId;
  }, []);

  useEffect(() => clearScheduledTimeouts, [clearScheduledTimeouts]);

  return {
    scheduleTimeout,
    clearScheduledTimeouts,
  };
};
