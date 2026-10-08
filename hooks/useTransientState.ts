import { useCallback, useState } from 'react';
import { useTimeoutManager } from './useTimeoutManager';

export const useTransientState = <T>(initialValue: T, defaultDuration = 3000) => {
  const [value, setValueState] = useState<T>(initialValue);
  const { scheduleTimeout, clearScheduledTimeouts } = useTimeoutManager();

  const setValue = useCallback(
    (nextValue: T) => {
      clearScheduledTimeouts();
      setValueState(nextValue);
    },
    [clearScheduledTimeouts],
  );

  const showValue = useCallback(
    (nextValue: T, duration = defaultDuration) => {
      clearScheduledTimeouts();
      setValueState(nextValue);
      scheduleTimeout(() => setValueState(initialValue), duration);
    },
    [clearScheduledTimeouts, defaultDuration, initialValue, scheduleTimeout],
  );

  return {
    value,
    setValue,
    showValue,
  };
};
