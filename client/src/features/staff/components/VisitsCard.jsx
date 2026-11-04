import { useState } from 'react';
import { BellRing, CalendarCheck, CalendarX, Check, Loader2, UserX, X } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/button';
import { formatDateTime, formatDay, formatTime } from '@/lib/format';

import { cancelVisit, recordVisitOutcome } from '../api';
import { useAction } from '../hooks/useAction';
import { BOOKED_VIA, VISIT_STATUSES } from '../labels';
import { StatusBadge } from './LeadBadges';
import { InlineError, Section } from './Section';

function Reminder({ label, sentAt, due }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={sentAt ? 'text-emerald-700' : 'text-muted-foreground'}>
        {sentAt ? `Sent ${formatDateTime(sentAt)}` : due ? 'Scheduled' : 'Not sent'}
      </span>
    </li>
  );
}

function VisitActions({ visit, now, onChanged }) {
  const { pending, error, run } = useAction(onChanged);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const started = new Date(visit.startsAt).getTime() <= now;

  if (visit.status !== 'booked') return null;

  return (
    <div className="space-y-2">
      {started ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={Boolean(pending)}
            onClick={() => run('visited', () => recordVisitOutcome(visit.id, 'visited'))}
          >
            {pending === 'visited' ? <Loader2 className="animate-spin" /> : <Check />} Visited
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={Boolean(pending)}
            onClick={() => run('no_show', () => recordVisitOutcome(visit.id, 'no_show'))}
          >
            {pending === 'no_show' ? <Loader2 className="animate-spin" /> : <UserX />} No-show
          </Button>
        </div>
      ) : confirmCancel ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">Cancel this visit and free the slot?</span>
          <Button
            size="sm"
            variant="destructive"
            disabled={Boolean(pending)}
            onClick={() => run('cancel', () => cancelVisit(visit.id))}
          >
            {pending === 'cancel' && <Loader2 className="animate-spin" />} Yes, cancel
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmCancel(false)}>
            Keep it
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setConfirmCancel(true)}>
          <X /> Cancel visit
        </Button>
      )}
      <InlineError>{error}</InlineError>
    </div>
  );
}

export function VisitsCard({ visits, now, onChanged }) {
  return (
    <Section title="Site visits" icon={CalendarCheck}>
      {visits.length === 0 ? (
        <EmptyState
          icon={CalendarX}
          title="No site visit yet"
          message="The assistant offers free slots in chat. Booked visits and their reminders show here."
          className="py-6"
        />
      ) : (
        <ul className="divide-y">
          {visits.map((visit) => {
            const upcoming = new Date(visit.startsAt).getTime() > now;
            return (
              <li key={visit.id} className="space-y-3 py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {formatDay(visit.startsAt)}, {formatTime(visit.startsAt)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {visit.project?.name} · {BOOKED_VIA[visit.bookedVia] ?? 'Booked'}
                    </p>
                  </div>
                  <StatusBadge status={visit.status} labels={VISIT_STATUSES} />
                </div>
                {visit.status !== 'cancelled' && (
                  <ul className="space-y-1 rounded-lg bg-muted/50 px-3 py-2 text-xs">
                    <li className="flex items-center gap-1.5 pb-0.5 font-medium">
                      <BellRing className="size-3.5" aria-hidden /> WhatsApp reminders
                    </li>
                    <Reminder
                      label="A day before"
                      sentAt={visit.reminders?.dayBeforeSentAt}
                      due={upcoming && visit.status === 'booked'}
                    />
                    <Reminder
                      label="2 hours before"
                      sentAt={visit.reminders?.twoHoursBeforeSentAt}
                      due={upcoming && visit.status === 'booked'}
                    />
                  </ul>
                )}
                <VisitActions visit={visit} now={now} onChanged={onChanged} />
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
