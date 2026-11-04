import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Loads data for a screen and exposes loading / error / retry states.
 * `load` receives an AbortSignal; the request is cancelled when `deps`
 * change or the component unmounts.
 *
 * When `deps` change the screen shows loading again, unless `keepPrevious`
 * is set: then the old data stays with `stale: true` until the new data lands.
 * `reload()` shows the loading state again; `refresh()` fetches in the
 * background and keeps the current data on screen (and on failure).
 */
export function useRequest(load, deps, { keepPrevious = false } = {}) {
  const key = JSON.stringify(deps);
  const [state, setState] = useState({ key, status: 'loading', data: undefined, error: null });
  const [attempt, setAttempt] = useState(0);
  const silent = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const background = silent.current;
    silent.current = false;
    load(controller.signal).then(
      (data) => setState({ key, status: 'ready', data, error: null }),
      (error) => {
        if (controller.signal.aborted) return;
        setState((current) =>
          background && current.status === 'ready' && current.key === key
            ? current
            : { key, status: 'error', data: undefined, error },
        );
      },
    );
    return () => controller.abort();
    // `load` is recreated every render; `deps` says when it really changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  const reload = useCallback(() => {
    setState((current) => ({ ...current, status: 'loading', error: null }));
    setAttempt((n) => n + 1);
  }, []);

  const refresh = useCallback(() => {
    silent.current = true;
    setAttempt((n) => n + 1);
  }, []);

  const stale = state.key !== key;
  const status = stale && !(keepPrevious && state.status === 'ready') ? 'loading' : state.status;
  return { status, data: state.data, error: state.error, stale, reload, refresh };
}
