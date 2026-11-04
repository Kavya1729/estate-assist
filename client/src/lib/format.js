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

/** The IST calendar date ("2026-11-05"), for grouping slots by day. */
export const istDateKey = (date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: IST_TIME_ZONE }).format(new Date(date));
