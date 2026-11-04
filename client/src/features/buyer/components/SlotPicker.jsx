import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';

import { ErrorState } from '@/components/feedback/ErrorState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRequest } from '@/hooks/useRequest';
import { ApiError } from '@/lib/api';
import { formatDay, formatDayMonth, formatTime, formatWeekday, istDateKey } from '@/lib/format';
import { cn } from '@/lib/utils';

import { bookVisit, fetchFreeSlots } from '../api';
import { useLanguage } from '../language';

const WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function groupByDay(slots) {
  const days = new Map();
  for (const slot of slots) {
    const key = istDateKey(slot.startsAt);
    if (!days.has(key)) days.set(key, []);
    days.get(key).push(slot);
  }
  return [...days.entries()].map(([key, daySlots]) => ({ key, slots: daySlots }));
}

/**
 * Real free slots, inside the chat: pick a day, then a time. The server books
 * atomically, so a slot taken a moment ago comes back as 409 and the list reloads.
 */
export function SlotPicker({ token, projectCode, projects, onBooked, onClose }) {
  const { t, language } = useLanguage();
  const [chosenProject, setChosenProject] = useState(projectCode);
  const [week, setWeek] = useState(0);
  const [dayKey, setDayKey] = useState(null);
  const [selected, setSelected] = useState(null);
  const [booking, setBooking] = useState(false);
  const [notice, setNotice] = useState(null);

  const [openedAt] = useState(() => Date.now());
  const from = istDateKey(openedAt + week * WINDOW_DAYS * DAY_MS);
  const request = useRequest(
    (signal) =>
      chosenProject
        ? fetchFreeSlots(chosenProject, { from, days: WINDOW_DAYS }, signal)
        : Promise.resolve(null),
    [chosenProject, from],
  );
  const days = useMemo(() => groupByDay(request.data?.slots ?? []), [request.data]);
  const activeDay = days.find((d) => d.key === dayKey) ?? days[0];

  function changeWeek(delta) {
    setWeek((w) => w + delta);
    setDayKey(null);
    setSelected(null);
    setNotice(null);
  }

  async function confirm() {
    setBooking(true);
    setNotice(null);
    try {
      const { visit } = await bookVisit(token, selected.id);
      onBooked(visit);
    } catch (err) {
      setBooking(false);
      const taken = err instanceof ApiError && err.status === 409;
      setNotice(taken ? t.slotTaken : err.message);
      if (taken) {
        setSelected(null);
        request.reload();
      }
    }
  }

  return (
    <section
      aria-label={t.pickSlot}
      className="animate-in fade-in-0 slide-in-from-bottom-2 rounded-2xl border bg-card p-4 shadow-sm sm:p-5"
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-serif text-lg">{chosenProject ? t.pickSlot : t.pickProject}</h2>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={t.closePicker}>
          <X />
        </Button>
      </div>

      {!chosenProject ? (
        <div className="flex flex-wrap gap-2">
          {projects.map((p) => (
            <Button key={p.code} variant="outline" onClick={() => setChosenProject(p.code)}>
              {p.name}
            </Button>
          ))}
        </div>
      ) : request.status === 'loading' ? (
        <div className="space-y-3" aria-busy>
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-16 rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-11 rounded-lg" />
            ))}
          </div>
        </div>
      ) : request.status === 'error' ? (
        <ErrorState
          title={t.loadSlotsFailed}
          message={request.error.message}
          onRetry={request.reload}
          retryLabel={t.retry}
        />
      ) : (
        <>
          {days.length === 0 ? (
            <p className="rounded-xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
              {t.noSlots}
            </p>
          ) : (
            <>
              <div
                className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                role="tablist"
              >
                {days.map((day) => {
                  const active = day.key === activeDay.key;
                  const first = day.slots[0].startsAt;
                  return (
                    <button
                      key={day.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => {
                        setDayKey(day.key);
                        setSelected(null);
                      }}
                      className={cn(
                        'flex min-w-16 shrink-0 cursor-pointer flex-col items-center rounded-xl border px-3 py-2 text-sm transition-colors hover:border-primary/40',
                        active && 'border-primary bg-primary text-primary-foreground',
                      )}
                    >
                      <span className="text-xs opacity-80">{formatWeekday(first, language)}</span>
                      <span className="font-medium">{formatDayMonth(first, language)}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 min-[380px]:grid-cols-3" role="tabpanel">
                {activeDay.slots.map((slot) => {
                  const isSelected = selected?.id === slot.id;
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setSelected(slot)}
                      className={cn(
                        'flex cursor-pointer flex-col items-center rounded-lg border px-2 py-2 transition-colors hover:border-primary/40',
                        isSelected && 'border-primary bg-primary/5 ring-1 ring-primary',
                      )}
                    >
                      <span className="text-sm font-medium">
                        {formatTime(slot.startsAt, language)}
                      </span>
                      {slot.remaining === 1 && (
                        <span className="text-[11px] text-muted-foreground">{t.seatsLeft(1)}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {notice && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {notice}
            </p>
          )}

          <div className="mt-4 flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={() => changeWeek(-1)} disabled={week === 0}>
              <ChevronLeft /> {t.earlierDates}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => changeWeek(1)}>
              {t.laterDates} <ChevronRight />
            </Button>
          </div>

          {selected && (
            <Button size="lg" className="mt-3 h-11 w-full" onClick={confirm} disabled={booking}>
              {booking ? (
                <>
                  <Loader2 className="animate-spin" /> {t.booking}
                </>
              ) : (
                t.confirmVisit(
                  `${formatDay(selected.startsAt, language)}, ${formatTime(selected.startsAt, language)}`,
                )
              )}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
