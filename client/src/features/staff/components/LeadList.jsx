import { CalendarCheck, ChevronRight } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router';

import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime, formatRelative } from '@/lib/format';

import { budgetLabel, interestLabel, leadName } from '../leadFormat';
import {
  DuplicateBadge,
  HandoffBadge,
  SourceTags,
  StatusBadge,
  TemperatureBadge,
} from './LeadBadges';

const lastActivity = (lead) => lead.conversation?.lastMessageAt ?? lead.updatedAt;

function Flags({ lead }) {
  return (
    <>
      {lead.handoff?.pending && <HandoffBadge />}
      <DuplicateBadge count={lead.openDuplicates} />
    </>
  );
}

/** A booked visit whose time has passed still needs its outcome recorded. */
function NextVisit({ visit, now }) {
  if (!visit) return <span className="text-muted-foreground">—</span>;
  const due = new Date(visit.startsAt).getTime() <= now;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5">
      <CalendarCheck className="size-3.5 text-primary" aria-hidden />
      {formatDateTime(visit.startsAt)}
      {due && <span className="text-xs font-medium text-orange-700">· outcome due</span>}
    </span>
  );
}

/** The detail page's back link returns to the list with the same filters and page. */
function useListState() {
  const location = useLocation();
  return { from: `${location.pathname}${location.search}` };
}

function LeadTable({ items, showOwner, now }) {
  const navigate = useNavigate();
  const state = useListState();
  return (
    <div className="hidden overflow-hidden rounded-xl border bg-card lg:block">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">Lead</th>
            <th className="px-3 py-2.5 font-medium">Interest</th>
            <th className="px-3 py-2.5 font-medium">Temperature</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="px-3 py-2.5 font-medium">Next visit</th>
            {showOwner && <th className="px-3 py-2.5 font-medium">Owner</th>}
            <th className="hidden px-4 py-2.5 text-right font-medium xl:table-cell">Activity</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((lead) => (
            <tr
              key={lead.id}
              onClick={() => navigate(`/staff/leads/${lead.id}`, { state })}
              className="cursor-pointer align-top transition-colors hover:bg-muted/40"
            >
              <td className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Link
                    to={`/staff/leads/${lead.id}`}
                    state={state}
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium hover:underline"
                  >
                    {leadName(lead)}
                  </Link>
                  <Flags lead={lead} />
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {lead.code} · {lead.phone ?? 'No phone'}
                </p>
                <SourceTags sources={lead.sources ?? [lead.primarySource]} className="mt-2" />
              </td>
              <td className="px-3 py-3">
                <p>{interestLabel(lead)}</p>
                <p className="text-xs text-muted-foreground">
                  {budgetLabel(lead.profile) ?? 'Budget not shared'}
                </p>
              </td>
              <td className="px-3 py-3">
                <TemperatureBadge temperature={lead.temperature} score={lead.score} />
              </td>
              <td className="px-3 py-3">
                <StatusBadge status={lead.status} />
              </td>
              <td className="px-3 py-3 whitespace-nowrap">
                <NextVisit visit={lead.upcomingVisit} now={now} />
              </td>
              {showOwner && (
                <td className="px-3 py-3">
                  {lead.assignedTo?.name ?? (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                </td>
              )}
              <td className="hidden px-4 py-3 text-right whitespace-nowrap text-muted-foreground xl:table-cell">
                {formatRelative(lastActivity(lead), now)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LeadCards({ items, showOwner, now }) {
  const state = useListState();
  return (
    <ul className="space-y-2 lg:hidden">
      {items.map((lead) => (
        <li key={lead.id}>
          <Link
            to={`/staff/leads/${lead.id}`}
            state={state}
            className="block rounded-xl border bg-card p-4 transition-colors hover:border-primary/30"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{leadName(lead)}</p>
                <p className="text-xs text-muted-foreground">
                  {lead.code} · {lead.phone ?? 'No phone'}
                </p>
              </div>
              <TemperatureBadge temperature={lead.temperature} score={lead.score} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <StatusBadge status={lead.status} />
              <Flags lead={lead} />
              <SourceTags sources={lead.sources ?? [lead.primarySource]} className="contents" />
            </div>
            <div className="mt-3 flex items-end justify-between gap-3 text-xs text-muted-foreground">
              <div className="min-w-0 space-y-0.5">
                <p className="truncate text-foreground">
                  {interestLabel(lead)}
                  {budgetLabel(lead.profile) && ` · ${budgetLabel(lead.profile)}`}
                </p>
                {lead.upcomingVisit && <NextVisit visit={lead.upcomingVisit} now={now} />}
                <p>
                  {showOwner && `${lead.assignedTo?.name ?? 'Unassigned'} · `}
                  {formatRelative(lastActivity(lead), now)}
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0" aria-hidden />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function LeadList(props) {
  return (
    <>
      <LeadTable {...props} />
      <LeadCards {...props} />
    </>
  );
}

export function LeadListSkeleton({ rows = 6 }) {
  return (
    <div aria-busy="true" aria-label="Loading leads">
      <div className="hidden overflow-hidden rounded-xl border bg-card lg:block">
        <div className="h-10 border-b bg-muted/50" />
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-6 border-b px-4 py-4 last:border-b-0">
            <div className="w-56 space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
      <div className="space-y-2 lg:hidden">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-3 rounded-xl border bg-card p-4">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="flex gap-1.5">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-3 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}
