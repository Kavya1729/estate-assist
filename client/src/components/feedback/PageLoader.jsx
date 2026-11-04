import { Loader2 } from 'lucide-react';

/** Full-screen placeholder while a lazily loaded screen downloads. */
export function PageLoader() {
  return (
    <div className="flex min-h-svh items-center justify-center" aria-busy="true">
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Loading" />
    </div>
  );
}
