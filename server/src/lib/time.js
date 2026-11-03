/** Both projects are in Ahmedabad; India has no daylight saving, so the offset is fixed. */
export const IST_TIME_ZONE = 'Asia/Kolkata';
const IST_OFFSET = '+05:30';

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

const LOCALES = { en: 'en-IN', hi: 'hi-IN', gu: 'gu-IN' };

/** `'2026-11-04'` → the instant that day starts in IST. */
export function istDayStart(isoDate) {
  return new Date(`${isoDate}T00:00:00${IST_OFFSET}`);
}

/** `('2026-11-04', '11:00')` → the instant of that wall-clock time in IST. */
export function istDateTime(isoDate, time) {
  return new Date(`${isoDate}T${time}:00${IST_OFFSET}`);
}

/** The IST calendar date (`YYYY-MM-DD`) an instant falls on. */
export function istDateOf(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST_TIME_ZONE }).format(date);
}

export function addDays(isoDate, days) {
  return istDateOf(new Date(istDayStart(isoDate).getTime() + days * DAY));
}

/** e.g. "Wed, 4 Nov, 11:00 am" in the buyer's language, always in IST. */
export function formatVisitTime(date, language = 'en') {
  return new Intl.DateTimeFormat(LOCALES[language] ?? LOCALES.en, {
    timeZone: IST_TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}
