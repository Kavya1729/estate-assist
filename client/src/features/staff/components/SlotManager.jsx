import { useState } from 'react';
import { CalendarClock, CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSearchParams } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useNow } from '@/hooks/useNow';
import { formatDay, istDateKey, shiftDateKey } from '@/lib/format';
import { cn } from '@/lib/utils';

import { SCHEDULE_DAYS, useSchedule } from '../hooks/useProjects';
import { SlotGenerator } from './SlotGenerator';
import { SlotRow } from './SlotRow';

const WEEKS_AHEAD = 8;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** The week shown, from `?from=`; never before today or past the booking horizon. */
function useWeek(now) {
  const [params, setParams] = useSearchParams();
  const today = istDateKey(now);
  const last = shiftDateKey(today, (WEEKS_AHEAD - 1) * SCHEDULE_DAYS);
  const requested = params.get('from');
  const from =
    requested && DATE_KEY.test(requested) && requested > today && requested <= last
      ? requested
      : today;

  function setFrom(key) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (key === today) next.delete('from');
        else next.set('from', key);
        return next;
      },
      { replace: true },
    );
  }
  return { from, today, last, setFrom };
}

function ScheduleSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2" aria-busy="true" aria-label="Loading slots">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="space-y-3 rounded-xl border bg-card p-4">
          <Skeleton className="h-4 w-24" />
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-center gap-3">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-8 w-24" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function weekTotals(slots, now) {
  const upcoming = slots.filter((s) => new Date(s.startsAt).getTime() > now);
  return {
    booked: slots.reduce((sum, s) => sum + s.bookedCount, 0),
    open: upcoming
      .filter((s) => !s.isBlocked)
      .reduce((sum, s) => sum + Math.max(s.capacity - s.bookedCount, 0), 0),
    blocked: upcoming.filter((s) => s.isBlocked).length,
  };
}

/** A week of visit slots for one project, with block, seat and add-slot controls. */
export function SlotManager({ project }) {
  const now = useNow();
  const { from, today, last, setFrom } = useWeek(now);
  const schedule = useSchedule(project.code, from);
  const [adding, setAdding] = useState(false);

  const days = Array.from({ length: SCHEDULE_DAYS }, (_, i) => shiftDateKey(from, i));
  const slots = schedule.data?.items ?? [];
  const byDay = new Map(days.map((day) => [day, []]));
  for (const slot of slots) byDay.get(istDateKey(slot.startsAt))?.push(slot);
  const totals = weekTotals(slots, now);
  const previousWeek = shiftDateKey(from, -SCHEDULE_DAYS);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous week"
            disabled={from <= today}
            onClick={() => setFrom(previousWeek < today ? today : previousWeek)}
          >
            <ChevronLeft />
          </Button>
          <p className="min-w-36 px-1 text-center text-sm font-medium">
            {formatDay(`${days[0]}T12:00:00+05:30`)} – {formatDay(`${days.at(-1)}T12:00:00+05:30`)}
          </p>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next week"
            disabled={shiftDateKey(from, SCHEDULE_DAYS) > last}
            onClick={() => setFrom(shiftDateKey(from, SCHEDULE_DAYS))}
          >
            <ChevronRight />
          </Button>
          {from !== today && (
            <Button variant="ghost" size="sm" onClick={() => setFrom(today)}>
              Today
            </Button>
          )}
        </div>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <CalendarPlus /> Add slots
          </Button>
        )}
      </div>

      {adding && (
        <SlotGenerator
          project={project}
          today={today}
          onCreated={schedule.refresh}
          onClose={() => setAdding(false)}
        />
      )}

      {schedule.status === 'loading' && <ScheduleSkeleton />}

      {schedule.status === 'error' && (
        <ErrorState
          title="Could not load the slots"
          message={schedule.error.message}
          onRetry={schedule.reload}
        />
      )}

      {schedule.status === 'ready' &&
        (slots.length === 0 && !schedule.stale ? (
          <EmptyState
            icon={CalendarClock}
            title="No visit slots this week"
            message="Buyers can only book times that have a slot. Add slots for the days the site office is open."
            action={
              !adding && (
                <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
                  <CalendarPlus /> Add slots
                </Button>
              )
            }
          />
        ) : (
          <div
            className={cn('space-y-3 transition-opacity', schedule.stale && 'opacity-60')}
            aria-busy={schedule.stale}
          >
            <p className="text-sm text-muted-foreground">
              {totals.booked} booked · {totals.open} open {totals.open === 1 ? 'seat' : 'seats'}
              {totals.blocked > 0 && ` · ${totals.blocked} blocked`} this week
            </p>
            <div className="grid items-start gap-4 lg:grid-cols-2">
              {days.map((day) => {
                const daySlots = byDay.get(day);
                return (
                  <section key={day} className="rounded-xl border bg-card">
                    <h3 className="border-b px-4 py-2.5 font-sans text-sm font-semibold tracking-normal">
                      {formatDay(`${day}T12:00:00+05:30`)}
                      {day === today && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          Today
                        </span>
                      )}
                    </h3>
                    {daySlots.length ? (
                      <ul className="divide-y px-4 py-3">
                        {daySlots.map((slot) => (
                          <SlotRow
                            key={slot.id}
                            slot={slot}
                            now={now}
                            onChanged={schedule.refresh}
                          />
                        ))}
                      </ul>
                    ) : (
                      <p className="px-4 py-3 text-sm text-muted-foreground">No slots</p>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}
