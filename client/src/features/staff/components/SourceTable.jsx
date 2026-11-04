import { formatDuration, formatPercent, formatRupees } from '@/lib/format';
import { cn } from '@/lib/utils';

import { SOURCES } from '../labels';

const money = (value) => (value == null ? '—' : formatRupees(value));

const COLUMNS = [
  { key: 'leads', label: 'Leads', render: (r) => r.leads },
  { key: 'hotLeads', label: 'Hot', render: (r) => r.hotLeads },
  { key: 'within', label: 'Within target', render: (r) => formatPercent(r.respondedWithinTarget) },
  {
    key: 'median',
    label: 'Median reply',
    render: (r) => formatDuration(r.medianFirstResponseSeconds),
  },
  { key: 'booked', label: 'Visits booked', render: (r) => r.visitsBooked },
  { key: 'visited', label: 'Visited', render: (r) => r.visited },
  { key: 'show', label: 'Show-up', render: (r) => formatPercent(r.showUpRate) },
  { key: 'spend', label: 'Spend', render: (r) => money(r.spend) },
  { key: 'cpl', label: 'Per lead', render: (r) => money(r.costPerLead) },
  { key: 'cpv', label: 'Per visit', render: (r) => money(r.costPerVisit) },
];

/** Every number per source, with the company total as the last row. */
export function SourceTable({ rows, totals }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[52rem] text-sm">
        <caption className="sr-only">Lead source performance</caption>
        <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="sticky left-0 bg-muted px-4 py-2.5 text-left font-medium">
              Source
            </th>
            {COLUMNS.map((c) => (
              <th key={c.key} scope="col" className="px-3 py-2.5 text-right font-medium">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {[...rows, { ...totals, source: 'total' }].map((row) => {
            const total = row.source === 'total';
            return (
              <tr key={row.source} className={cn(total && 'bg-muted/40 font-medium')}>
                <th
                  scope="row"
                  className={cn(
                    'sticky left-0 px-4 py-2.5 text-left font-normal',
                    total ? 'bg-muted font-medium' : 'bg-card',
                  )}
                >
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    {!total && (
                      <span
                        className={cn('size-2 rounded-full', SOURCES[row.source]?.dot)}
                        aria-hidden
                      />
                    )}
                    {total ? 'All sources' : (SOURCES[row.source]?.label ?? row.source)}
                  </span>
                </th>
                {COLUMNS.map((c) => (
                  <td key={c.key} className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
