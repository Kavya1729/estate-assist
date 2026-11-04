import { AlertCircle, RotateCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** A failed load with the reason and a way to try again. */
export function ErrorState({ title, message, onRetry, retryLabel = 'Try again', className }) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-8 text-center',
        className,
      )}
    >
      <AlertCircle className="size-5 text-destructive" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw /> {retryLabel}
        </Button>
      )}
    </div>
  );
}
