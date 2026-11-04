import { Loader2, Lock, LockOpen, Minus, Plus } from 'lucide-react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

import { updateSlot } from '../api';
import { useAction } from '../hooks/useAction';
import { leadName } from '../leadFormat';
import { InlineError } from './Section';

const MAX_CAPACITY = 20;

function slotState(slot, past) {
  if (slot.isBlocked) return { label: 'Blocked', className: 'bg-muted text-muted-foreground' };
  if (past) return { label: 'Past', className: 'bg-muted text-muted-foreground' };
  const open = slot.capacity - slot.bookedCount;
  if (open <= 0) return { label: 'Full', className: 'bg-amber-100 text-amber-900' };
  return { label: `${open} open`, className: 'bg-emerald-100 text-emerald-800' };
}

/** One visit slot: who is booked, and controls to block it or change its seats. */
export function SlotRow({ slot, now, onChanged }) {
  const { pending, error, run } = useAction(onChanged);
  const past = new Date(slot.startsAt).getTime() <= now;
  const state = slotState(slot, past);
  const change = (key, patch) => run(key, () => updateSlot(slot.id, patch));

  return (
    <li className="grid gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[5.5rem_minmax(0,1fr)_auto] sm:items-center">
      <div className="flex items-baseline gap-1.5 sm:block">
        <p className="font-medium tabular-nums">{formatTime(slot.startsAt)}</p>
        <p className="text-xs text-muted-foreground">to {formatTime(slot.endsAt)}</p>
      </div>

      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', state.className)}>
            {state.label}
          </span>
          <span className="text-xs text-muted-foreground">
            {slot.bookedCount} of {slot.capacity} booked
          </span>
        </div>
        {slot.visits.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Booked buyers">
            {slot.visits.map((visit) => (
              <li key={visit.id}>
                <Link
                  to={`/staff/leads/${visit.lead?.id}`}
                  className="inline-block max-w-48 truncate rounded-full border px-2 py-0.5 text-xs hover:bg-muted"
                >
                  {visit.lead ? leadName(visit.lead) : 'Lead removed'}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!past && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-md border" role="group" aria-label="Seats">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="One seat fewer"
              disabled={Boolean(pending) || slot.capacity <= Math.max(1, slot.bookedCount)}
              onClick={() => change('capacity', { capacity: slot.capacity - 1 })}
            >
              <Minus />
            </Button>
            <span className="w-16 text-center text-xs tabular-nums">
              {pending === 'capacity' ? (
                <Loader2 className="mx-auto size-3.5 animate-spin" aria-label="Saving" />
              ) : (
                `${slot.capacity} ${slot.capacity === 1 ? 'seat' : 'seats'}`
              )}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="One seat more"
              disabled={Boolean(pending) || slot.capacity >= MAX_CAPACITY}
              onClick={() => change('capacity', { capacity: slot.capacity + 1 })}
            >
              <Plus />
            </Button>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="w-24"
            disabled={Boolean(pending)}
            onClick={() => change('block', { isBlocked: !slot.isBlocked })}
          >
            {pending === 'block' ? (
              <Loader2 className="animate-spin" />
            ) : slot.isBlocked ? (
              <LockOpen />
            ) : (
              <Lock />
            )}
            {slot.isBlocked ? 'Unblock' : 'Block'}
          </Button>
        </div>
      )}

      {slot.isBlocked && slot.bookedCount > 0 && !past && (
        <p className="text-xs text-muted-foreground sm:col-span-3">
          No new bookings. The{' '}
          {slot.bookedCount === 1 ? 'visit already booked stays' : 'visits already booked stay'}{' '}
          unless you cancel {slot.bookedCount === 1 ? 'it' : 'them'} on the lead page.
        </p>
      )}
      {error && (
        <div className="sm:col-span-3">
          <InlineError>{error}</InlineError>
        </div>
      )}
    </li>
  );
}
