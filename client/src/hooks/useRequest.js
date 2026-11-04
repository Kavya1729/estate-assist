import { useCallback, useEffect, useState } from 'react';

/**
 * Loads data for a screen and exposes loading / error / retry states.
 * `load` receives an AbortSignal; the request is cancelled when `deps`
 * change or the component unmounts.
 */
export function useRequest(load, deps) {
  const [state, setState] = useState({ status: 'loading', data: undefined, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then(
      (data) => setState({ status: 'ready', data, error: null }),
      (error) => {
        if (!controller.signal.aborted) setState({ status: 'error', data: undefined, error });
      },
    );
    return () => controller.abort();
    // `load` is recreated every render; `deps` says when it really changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const reload = useCallback(() => {
    setState((current) => ({ ...current, status: 'loading', error: null }));
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, reload };
}
