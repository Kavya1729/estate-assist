import { useState } from 'react';
import { CalendarPlus, Loader2, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { generateSlots } from '../api';
import { useAction } from '../hooks/useAction';
import { InlineError } from './Section';

const DEFAULT_TIMES = ['10:00', '11:00', '12:00', '15:00', '16:00', '17:00', '18:00'];
const MAX_TIMES = 12;

const inRange = (value, min, max) => {
  const n = Number(value);
  return value !== '' && Number.isInteger(n) && n >= min && n <= max;
};

function findProblem({ from, today, days, capacity, times }) {
  if (!from || from < today) return 'Start today or later.';
  if (!inRange(days, 1, 30)) return 'Days is a whole number from 1 to 30.';
  if (!inRange(capacity, 1, 20)) return 'Seats is a whole number from 1 to 20.';
  if (!times.length) return 'Add at least one time.';
  return null;
}

/** Adds slots at the chosen times every day in a date range; existing slots stay untouched. */
export function SlotGenerator({ project, today, onCreated, onClose }) {
  const [from, setFrom] = useState(today);
  const [days, setDays] = useState('14');
  const [capacity, setCapacity] = useState('2');
  const [times, setTimes] = useState(DEFAULT_TIMES);
  const [newTime, setNewTime] = useState('');
  const [created, setCreated] = useState(null);
  const [invalid, setInvalid] = useState(null);
  const { pending, error, run } = useAction();

  function addTime() {
    if (!newTime || times.includes(newTime) || times.length >= MAX_TIMES) return;
    setTimes([...times, newTime].sort());
    setNewTime('');
  }

  async function submit(event) {
    event.preventDefault();
    setCreated(null);
    const problem = findProblem({ from, today, days, capacity, times });
    setInvalid(problem);
    if (problem) return;

    await run('create', async () => {
      const result = await generateSlots(project.code, {
        from,
        days: Number(days),
        times,
        capacity: Number(capacity),
      });
      setCreated(result.created);
      onCreated();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-4 sm:p-5" noValidate>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 font-sans text-sm font-semibold tracking-normal">
            <CalendarPlus className="size-4 text-muted-foreground" aria-hidden /> Add visit slots
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Each slot lasts {project.visitDurationMinutes} minutes. Times that already have a slot
            are skipped, so nothing booked changes.
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
          <X />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="slots-from">First day</Label>
          <Input
            id="slots-from"
            type="date"
            min={today}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="slots-days">For how many days</Label>
          <Input
            id="slots-days"
            type="number"
            min={1}
            max={30}
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="slots-capacity">Seats per slot</Label>
          <Input
            id="slots-capacity"
            type="number"
            min={1}
            max={20}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="slots-time">Times each day (IST)</Label>
        <ul className="flex flex-wrap gap-1.5">
          {times.map((time) => (
            <li
              key={time}
              className="flex items-center gap-1 rounded-full border bg-muted/40 py-0.5 pr-1 pl-2.5 text-sm tabular-nums"
            >
              {time}
              <button
                type="button"
                className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`Remove ${time}`}
                onClick={() => setTimes(times.filter((t) => t !== time))}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input
            id="slots-time"
            type="time"
            step={900}
            className="w-32"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTime();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            disabled={!newTime || times.includes(newTime) || times.length >= MAX_TIMES}
            onClick={addTime}
          >
            <Plus /> Add time
          </Button>
        </div>
      </div>

      <InlineError>{invalid ?? error}</InlineError>
      {created !== null && (
        <p role="status" className="text-sm text-emerald-700">
          {created === 0
            ? 'No new slots: every one of those times already had a slot.'
            : `Added ${created} ${created === 1 ? 'slot' : 'slots'}. Slots that already existed were left as they were.`}
        </p>
      )}

      <Button type="submit" disabled={Boolean(pending)}>
        {pending && <Loader2 className="animate-spin" />} Add slots
      </Button>
    </form>
  );
}
