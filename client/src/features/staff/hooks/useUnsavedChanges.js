import { useEffect } from 'react';
import { useBlocker } from 'react-router';

/**
 * Holds in-app navigation (other pages, other tabs or projects in the URL) while
 * there are unsaved edits, and asks the browser to confirm closing the tab.
 */
export function useUnsavedChanges(dirty) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
  );

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  return blocker;
}
