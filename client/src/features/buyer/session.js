import { useSyncExternalStore } from 'react';

/**
 * The buyer's chat token lives in localStorage so a refresh or a later visit
 * picks the conversation up again. It only grants access to this buyer's chat.
 */
const KEY = 'estate-assist.buyer-token';
const CHANGE = 'estate-assist:buyer-token';

let memory = null;

function read() {
  try {
    return localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
}

function write(token) {
  memory = token;
  try {
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
  } catch {
    // Private mode without storage: the chat still works until the tab closes.
  }
  window.dispatchEvent(new Event(CHANGE));
}

export const saveBuyerToken = (token) => write(token);
export const clearBuyerToken = () => write(null);

function subscribe(onChange) {
  window.addEventListener(CHANGE, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function useBuyerToken() {
  return useSyncExternalStore(subscribe, read, () => null);
}
