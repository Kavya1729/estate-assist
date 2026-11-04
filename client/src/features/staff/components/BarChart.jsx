import { cn } from '@/lib/utils';

/**
 * Horizontal bars, one row per source. A row has `segments` (stacked, each
 * `{ value, className, label }`) scaled against `max`, a `display` value and
 * an optional `hint`. Each row is also described in text for screen readers.
 */
export function BarChart({ rows, max, legend, className }) {
  const scale = max ?? Math.max(1, ...rows.map((r) => r.segments.reduce((s, x) => s + x.value, 0)));

  return (
    <div className={cn('space-y-4', className)}>
      <ul className="space-y-3.5">
        {rows.map((row) => (
          <li key={row.key} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className={cn('size-2 shrink-0 rounded-full', row.dot)} aria-hidden />
                <span className="truncate">{row.label}</span>
              </span>
              <span className="shrink-0 font-medium tabular-nums">{row.display}</span>
            </div>
            <div
              className="flex h-2.5 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`${row.label}: ${row.display}${row.hint ? `, ${row.hint}` : ''}`}
            >
              {row.segments.map((segment) =>
                segment.value > 0 ? (
                  <div
                    key={segment.label}
                    className={cn(
                      'h-full first:rounded-l-full last:rounded-r-full',
                      segment.className,
                    )}
                    style={{ width: `${Math.min(100, (segment.value / scale) * 100)}%` }}
                    title={`${segment.label}: ${segment.value}`}
                  />
                ) : null,
              )}
            </div>
            {row.hint && <p className="text-xs text-muted-foreground">{row.hint}</p>}
          </li>
        ))}
      </ul>
      {legend && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {legend.map((item) => (
            <li key={item.label} className="flex items-center gap-1.5">
              <span className={cn('size-2 rounded-full', item.className)} aria-hidden />
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
