import { cn } from '@/lib/utils';

export function StatCard({ label, value, hint, icon: Icon, className }) {
  return (
    <div className={cn('rounded-xl border bg-card p-4 sm:p-5', className)}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {Icon && <Icon className="size-3.5" aria-hidden />}
        {label}
      </p>
      <p className="mt-2 font-serif text-2xl tracking-tight tabular-nums sm:text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
