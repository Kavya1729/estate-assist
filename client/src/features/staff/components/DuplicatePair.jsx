import { useState } from 'react';
import { GitMerge, Loader2, X } from 'lucide-react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import { formatDateTime, formatDayMonth } from '@/lib/format';
import { cn } from '@/lib/utils';

import { resolveDuplicate } from '../api';
import { useAction } from '../hooks/useAction';
import { DUPLICATE_REASONS, TIMELINES } from '../labels';
import { budgetLabel, leadName } from '../leadFormat';
import { SourceTags, StatusBadge, TemperatureBadge } from './LeadBadges';
import { InlineError } from './Section';

/**
 * `fills`: a blank on the kept lead is filled from the other one when merging.
 * `highlight: false`: a difference that says nothing about whether it is the same buyer.
 */
const ROWS = [
  { label: 'Name', text: (l) => l.name, fills: true },
  { label: 'Phone', text: (l) => l.phone, fills: true },
  { label: 'Email', text: (l) => l.email, fills: true },
  { label: 'Project', text: (l) => l.project?.name, fills: true },
  { label: 'BHK', text: (l) => l.profile.bhk && `${l.profile.bhk} BHK`, fills: true },
  { label: 'Budget', text: (l) => budgetLabel(l.profile), fills: true },
  {
    label: 'Timeline',
    text: (l) => (l.profile.timeline === 'unknown' ? null : TIMELINES[l.profile.timeline]),
    fills: true,
  },
  { label: 'Assigned to', text: (l) => l.assignedTo?.name, fills: true },
  {
    label: 'Upcoming visit',
    text: (l) => l.upcomingVisit && formatDateTime(l.upcomingVisit.startsAt),
  },
  { label: 'Sources', render: (l) => <SourceTags sources={l.sources} /> },
  { label: 'Status', render: (l) => <StatusBadge status={l.status} /> },
  {
    label: 'Score',
    render: (l) => <TemperatureBadge temperature={l.temperature} score={l.score} />,
  },
  { label: 'First enquiry', text: (l) => formatDayMonth(l.createdAt), highlight: false },
];

const BLOCKED = {
  other_owner: (other) =>
    `Only the sales head can merge: ${other.code} belongs to ${other.assignedTo?.name ?? 'nobody yet'}.`,
  both_have_visits: () =>
    'Both leads have a visit booked. Cancel one of the visits on its lead page, then merge.',
};

const same = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

function Cell({ row, lead, differs, fillsIn }) {
  const text = row.text?.(lead);
  return (
    <dd
      className={cn(
        'min-w-0 rounded-md px-2 py-1 text-sm break-words',
        differs && 'bg-amber-50 text-amber-950',
      )}
    >
      {row.render ? row.render(lead) : text || <span className="text-muted-foreground">—</span>}
      {fillsIn && <span className="block text-xs text-emerald-700">Filled in on merge</span>}
    </dd>
  );
}

function SideHeading({ lead, label }) {
  return (
    <div className="min-w-0 px-2">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <Link
        to={`/staff/leads/${lead.id}`}
        state={{ from: '/staff/duplicates' }}
        className="block font-medium break-words hover:underline"
      >
        {leadName(lead)}
      </Link>
      <p className="text-xs text-muted-foreground">{lead.code}</p>
    </div>
  );
}

const ROW_GRID =
  'grid grid-cols-2 gap-x-2 gap-y-0.5 sm:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1fr)] sm:items-start';

/** Two leads that may be the same buyer, side by side, with merge and dismiss. */
export function DuplicatePair({ pair, onDone }) {
  const { lead, other } = pair;
  const { pending, error, run } = useAction(() => onDone(pair.id));
  const [confirming, setConfirming] = useState(false);
  const blocked = pair.mergeBlockedBy && BLOCKED[pair.mergeBlockedBy]?.(other);

  return (
    <article className="rounded-xl border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
        <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-800">
          {DUPLICATE_REASONS[pair.reason] ?? pair.reason}
        </span>
        <span className="text-xs text-muted-foreground">
          Flagged {formatDayMonth(pair.flaggedAt)}
        </span>
      </header>

      <div className="space-y-4 px-2 py-3 sm:px-3">
        <dl>
          <div className={cn(ROW_GRID, 'pb-2')}>
            <span className="hidden sm:block" aria-hidden />
            <SideHeading lead={lead} label="Keeps" />
            <SideHeading lead={other} label="Merges in" />
          </div>
          {ROWS.map((row) => {
            const left = row.text?.(lead);
            const right = row.text?.(other);
            const differs = row.highlight !== false && Boolean(left && right && !same(left, right));
            return (
              <div key={row.label} className={cn(ROW_GRID, 'border-t py-1.5')}>
                <dt className="col-span-2 px-2 pt-1 text-xs text-muted-foreground sm:col-span-1">
                  {row.label}
                </dt>
                <Cell
                  row={row}
                  lead={lead}
                  differs={differs}
                  fillsIn={row.fills && !left && right}
                />
                <Cell row={row} lead={other} differs={differs} />
              </div>
            );
          })}
        </dl>
        <p className="px-2 text-xs text-muted-foreground">
          Highlighted rows differ. Merging keeps {lead.code}: blanks are filled in from {other.code}
          , known details are never overwritten, and the first enquiry keeps the source credit.
        </p>

        <div className="space-y-2 px-2">
          {blocked && <p className="text-sm text-muted-foreground">{blocked}</p>}
          {confirming ? (
            <div className="space-y-2 rounded-lg bg-muted/50 p-3 text-sm">
              <p>
                Merge {other.code} into {lead.code}? Its sources, chat and visit move across and{' '}
                {other.code} leaves the lead list.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={Boolean(pending)}
                  onClick={() => run('merge', () => resolveDuplicate(lead.id, other.id, 'merged'))}
                >
                  {pending === 'merge' && <Loader2 className="animate-spin" />} Yes, merge
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={Boolean(pending)}
                  onClick={() => setConfirming(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={Boolean(pending) || Boolean(blocked)}
                onClick={() => setConfirming(true)}
              >
                <GitMerge /> Merge
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={Boolean(pending)}
                onClick={() => run('ignore', () => resolveDuplicate(lead.id, other.id, 'ignored'))}
              >
                {pending === 'ignore' ? <Loader2 className="animate-spin" /> : <X />} Not the same
                person
              </Button>
            </div>
          )}
          <InlineError>{error}</InlineError>
        </div>
      </div>
    </article>
  );
}
