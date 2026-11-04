import { useMemo, useSyncExternalStore } from 'react';

/**
 * The staff session (JWT and who signed in) is kept apart from the buyer's
 * chat token, so one browser can hold both without either seeing the other.
 */
const KEY = 'estate-assist.staff-session';
const CHANGE = 'estate-assist:staff-session';

let memory = null;
let endReason = null;

function read() {
  try {
    return localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
}

function write(value) {
  memory = value;
  try {
    if (value) localStorage.setItem(KEY, value);
    else localStorage.removeItem(KEY);
  } catch {
    // Private mode without storage: the session lasts until the tab closes.
  }
  window.dispatchEvent(new Event(CHANGE));
}

function parse(raw) {
  try {
    const session = JSON.parse(raw);
    return session?.token && session?.user ? session : null;
  } catch {
    return null;
  }
}

export function saveStaffSession({ token, user }) {
  endReason = null;
  write(JSON.stringify({ token, user }));
}

/** `reason` is shown on the sign-in screen ("expired" after a 401). */
export function endStaffSession(reason = null) {
  endReason = reason;
  write(null);
}

export const staffSessionEndReason = () => endReason;

export const staffToken = () => parse(read())?.token ?? null;

function subscribe(onChange) {
  window.addEventListener(CHANGE, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** `{ token, user }` or null. */
export function useStaffSession() {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  return useMemo(() => (raw ? parse(raw) : null), [raw]);
}

/** The signed-in staff member, or null in the render where sign-out happens. */
export const useStaffUser = () => useStaffSession()?.user ?? null;

export const isSalesHead = (user) => user?.role === 'sales_head';
