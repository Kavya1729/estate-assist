import { useRouteError } from 'react-router';

import { ErrorState } from '@/components/feedback/ErrorState';

/** A screen failed to load (usually its code chunk, after a deploy or offline). */
export function RouteErrorPage() {
  const error = useRouteError();
  if (import.meta.env.DEV) console.error(error);

  return (
    <div className="flex min-h-svh items-center justify-center px-5">
      <ErrorState
        title="This page could not be loaded"
        message="Check your connection, then reload the page."
        retryLabel="Reload"
        onRetry={() => window.location.reload()}
        className="w-full max-w-sm bg-card"
      />
    </div>
  );
}
