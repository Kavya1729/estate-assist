import { useCallback, useEffect, useReducer, useRef } from 'react';

import { ApiError } from '@/lib/api';

import { fetchChat, fetchVisit, sendChatMessage } from '../api';
import { clearBuyerToken } from '../session';

/** While a person has the chat, check for their replies this often. */
const HUMAN_POLL_MS = 5000;

const initialState = {
  status: 'loading', // loading | ready | error | expired
  error: null,
  mode: 'ai',
  buyer: null,
  messages: [],
  /** Buyer messages not yet confirmed by the server: `{ localId, text, status: 'sending' | 'failed', error }`. */
  outbox: [],
  awaitingReply: false,
  pickerOpen: false,
  bookedVisit: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'loaded':
      return {
        ...state,
        status: 'ready',
        error: null,
        mode: action.chat.mode,
        buyer: action.chat.buyer,
        messages: action.chat.messages,
      };
    case 'loadFailed':
      return { ...state, status: 'error', error: action.error };
    case 'reloading':
      return { ...state, status: 'loading', error: null };
    case 'expired':
      return { ...state, status: 'expired' };
    case 'sending':
      return {
        ...state,
        awaitingReply: true,
        outbox: [
          ...state.outbox.filter((m) => m.localId !== action.localId),
          { localId: action.localId, text: action.text, status: 'sending' },
        ],
      };
    case 'sent': {
      const { localId, text, response } = action;
      const buyerMessage = {
        id: localId,
        role: 'buyer',
        text,
        createdAt: new Date().toISOString(),
      };
      return {
        ...state,
        awaitingReply: false,
        mode: response.mode,
        outbox: state.outbox.filter((m) => m.localId !== localId),
        messages: [
          ...state.messages,
          buyerMessage,
          ...(response.reply ? [{ id: `${localId}-reply`, ...response.reply }] : []),
        ],
        pickerOpen: state.pickerOpen || response.offerSlots,
      };
    }
    case 'sendFailed':
      return {
        ...state,
        awaitingReply: false,
        outbox: state.outbox.map((m) =>
          m.localId === action.localId ? { ...m, status: 'failed', error: action.error } : m,
        ),
      };
    case 'discard':
      return { ...state, outbox: state.outbox.filter((m) => m.localId !== action.localId) };
    case 'openPicker':
      return { ...state, pickerOpen: true };
    case 'closePicker':
      return { ...state, pickerOpen: false };
    case 'visitBooked':
      return { ...state, pickerOpen: false, bookedVisit: action.visit };
    default:
      return state;
  }
}

const isExpired = (err) => err instanceof ApiError && err.status === 401;

/**
 * The buyer's conversation: loading, optimistic sending with retry, the slot
 * picker and booked visit, and polling for staff replies once a person has
 * taken over.
 */
export function useChat(token) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const sendingRef = useRef(false);

  const expire = useCallback(() => {
    clearBuyerToken();
    dispatch({ type: 'expired' });
  }, []);

  const refresh = useCallback(
    async (signal) => {
      try {
        const chat = await fetchChat(token, signal);
        // A refresh landing mid-send would show the message twice; the send result wins.
        if (!sendingRef.current) dispatch({ type: 'loaded', chat });
      } catch (err) {
        if (signal?.aborted) return;
        if (isExpired(err)) expire();
        else throw err;
      }
    },
    [token, expire],
  );

  useEffect(() => {
    if (!token) return undefined;
    const controller = new AbortController();
    refresh(controller.signal).catch((error) => dispatch({ type: 'loadFailed', error }));
    fetchVisit(token, controller.signal).then(
      ({ visit }) => visit && dispatch({ type: 'visitBooked', visit }),
      () => {},
    );
    return () => controller.abort();
  }, [token, refresh]);

  useEffect(() => {
    if (state.status !== 'ready' || state.mode !== 'human') return undefined;
    const timer = setInterval(() => refresh().catch(() => {}), HUMAN_POLL_MS);
    return () => clearInterval(timer);
  }, [state.status, state.mode, refresh]);

  const loadBookedVisit = useCallback(async () => {
    try {
      const { visit } = await fetchVisit(token);
      if (visit) dispatch({ type: 'visitBooked', visit });
    } catch {
      // The confirmation already reads in the chat; the card is a convenience.
    }
  }, [token]);

  const reload = useCallback(() => {
    dispatch({ type: 'reloading' });
    refresh().catch((error) => dispatch({ type: 'loadFailed', error }));
    loadBookedVisit();
  }, [refresh, loadBookedVisit]);

  const send = useCallback(
    async (rawText, { localId = crypto.randomUUID() } = {}) => {
      const text = rawText.trim();
      if (!text || sendingRef.current) return;
      sendingRef.current = true;
      dispatch({ type: 'sending', localId, text });
      let delivered = false;
      try {
        const response = await sendChatMessage(token, text);
        dispatch({ type: 'sent', localId, text, response });
        delivered = true;
        if (response.visitBooked) loadBookedVisit();
      } catch (err) {
        if (isExpired(err)) expire();
        else dispatch({ type: 'sendFailed', localId, error: err.message });
      } finally {
        sendingRef.current = false;
      }
      // The server's copy is authoritative (ids, opt-out state after STOP / START in any language).
      if (delivered) refresh().catch(() => {});
    },
    [token, expire, loadBookedVisit, refresh],
  );

  const retry = useCallback(
    (localId) => {
      const failed = state.outbox.find((m) => m.localId === localId);
      if (failed) send(failed.text, { localId });
    },
    [state.outbox, send],
  );

  const discard = useCallback((localId) => dispatch({ type: 'discard', localId }), []);
  const openPicker = useCallback(() => dispatch({ type: 'openPicker' }), []);
  const closePicker = useCallback(() => dispatch({ type: 'closePicker' }), []);

  /** After the picker booked a slot: show the card and pull in the confirmation the server wrote. */
  const onVisitBooked = useCallback(
    (visit) => {
      dispatch({ type: 'visitBooked', visit });
      refresh().catch(() => {});
    },
    [refresh],
  );

  return {
    ...state,
    send,
    retry,
    discard,
    reload,
    openPicker,
    closePicker,
    onVisitBooked,
  };
}
