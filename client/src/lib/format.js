/** Both projects are in Ahmedabad, so visit times are always shown in IST. */
export const IST_TIME_ZONE = 'Asia/Kolkata';

const LOCALES = { en: 'en-IN', hi: 'hi-IN', gu: 'gu-IN' };
const LAKH = 100_000;
const CRORE = 100 * LAKH;

const localeOf = (language) => LOCALES[language] ?? LOCALES.en;
const trim = (value) => Number(value.toFixed(2)).toString();

/** 6500000 → "₹65 lakh", 12000000 → "₹1.2 crore" (same wording the assistant uses). */
export function formatRupees(amount) {
  if (amount >= CRORE) return `₹${trim(amount / CRORE)} crore`;
  if (amount >= LAKH) return `₹${trim(amount / LAKH)} lakh`;
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function formatRupeeRange({ min, max }) {
  return min === max ? formatRupees(min) : `${formatRupees(min)} – ${formatRupees(max)}`;
}

function format(date, language, options) {
  return new Intl.DateTimeFormat(localeOf(language), {
    timeZone: IST_TIME_ZONE,
    ...options,
  }).format(new Date(date));
}

/** "Thu, 5 Nov" */
export const formatDay = (date, language) =>
  format(date, language, { weekday: 'short', day: 'numeric', month: 'short' });

/** "Thu" */
export const formatWeekday = (date, language) => format(date, language, { weekday: 'short' });

/** "5 Nov" */
export const formatDayMonth = (date, language) =>
  format(date, language, { day: 'numeric', month: 'short' });

/** "Thursday, 5 November" */
export const formatLongDay = (date, language) =>
  format(date, language, { weekday: 'long', day: 'numeric', month: 'long' });

/** "11:00 am" */
export const formatTime = (date, language) =>
  format(date, language, { hour: 'numeric', minute: '2-digit' });

/** "December 2027" */
export const formatMonthYear = (date, language) =>
  format(date, language, { month: 'long', year: 'numeric' });

/** "5 Nov, 11:00 am" */
export const formatDateTime = (date, language) =>
  format(date, language, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

const RELATIVE_STEPS = [
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

/** "5 minutes ago", "in 2 days"; `now` is passed in so renders stay pure. */
export function formatRelative(date, now, language) {
  const seconds = (new Date(date).getTime() - now) / 1000;
  const rtf = new Intl.RelativeTimeFormat(localeOf(language), { numeric: 'auto' });
  for (const [unit, size] of RELATIVE_STEPS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(0, 'minute');
}

/** 24 → "24 s", 270 → "4.5 min", 3240 → "54 min", 9000 → "2.5 h" */
export function formatDuration(seconds) {
  if (seconds == null) return '—';
  if (seconds < 60) return `${Math.round(seconds)} s`;
  if (seconds < 3_600) return `${trim(Math.round((seconds / 60) * 10) / 10)} min`;
  if (seconds < 86_400) return `${trim(Math.round((seconds / 3_600) * 10) / 10)} h`;
  return `${trim(Math.round((seconds / 86_400) * 10) / 10)} d`;
}

/** 0.833 → "83%" */
export const formatPercent = (ratio) => (ratio == null ? '—' : `${Math.round(ratio * 100)}%`);

/** The IST calendar date ("2026-11-05"), for grouping slots by day. */
export const istDateKey = (date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: IST_TIME_ZONE }).format(new Date(date));

/** Moves an IST calendar date by whole days: ("2026-11-05", 7) → "2026-11-12". */
export const shiftDateKey = (key, days) =>
  istDateKey(new Date(`${key}T12:00:00+05:30`).getTime() + days * 86_400_000);
