import { cn } from '@/lib/utils';

/** Nothing to show yet, with what it means and (optionally) what to do next. */
export function EmptyState({ icon: Icon, title, message, action, className }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center',
        className,
      )}
    >
      {Icon && (
        <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {message && <p className="max-w-sm text-sm text-muted-foreground">{message}</p>}
      </div>
      {action}
    </div>
  );
}
