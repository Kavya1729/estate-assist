import { cn } from '@/lib/utils';

/** A titled card on the lead detail and dashboard screens. */
export function Section({ title, icon: Icon, description, action, className, children }) {
  return (
    <section className={cn('rounded-xl border bg-card', className)}>
      <header className="flex items-start justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-sans text-sm font-semibold tracking-normal">
            {Icon && <Icon className="size-4 text-muted-foreground" aria-hidden />}
            {title}
          </h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </header>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  );
}

export function InlineError({ children }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {children}
    </p>
  );
}
