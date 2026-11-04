import { useCallback, useState } from 'react';

/**
 * One button-triggered request at a time: which action is running and the
 * last error. `onDone` runs after a success (usually a background refresh).
 */
export function useAction(onDone) {
  const [pending, setPending] = useState(null);
  const [error, setError] = useState(null);

  const run = useCallback(
    async (key, request) => {
      setPending(key);
      setError(null);
      try {
        const result = await request();
        onDone?.(result);
        return true;
      } catch (err) {
        setError(err.message);
        return false;
      } finally {
        setPending(null);
      }
    },
    [onDone],
  );

  return { pending, error, run, clearError: () => setError(null) };
}
