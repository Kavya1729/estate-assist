import { api } from '@/lib/api';

const withToken = (token) => ({ Authorization: `Bearer ${token}` });

export const fetchCatalog = (signal) => api('/projects/catalog', { signal });

export const startChat = (body) => api('/chat/sessions', { method: 'POST', body });

export const fetchChat = (token, signal) =>
  api('/chat/messages', { headers: withToken(token), signal });

export const sendChatMessage = (token, text) =>
  api('/chat/messages', { method: 'POST', headers: withToken(token), body: { text } });

export function fetchFreeSlots(projectCode, { from, days = 7 }, signal) {
  const query = new URLSearchParams({ days: String(days), ...(from && { from }) });
  return api(`/projects/${encodeURIComponent(projectCode)}/slots?${query}`, { signal });
}

export const fetchVisit = (token, signal) =>
  api('/chat/visit', { headers: withToken(token), signal });

export const bookVisit = (token, slotId) =>
  api('/chat/visit', { method: 'POST', headers: withToken(token), body: { slotId } });

export const cancelVisit = (token) =>
  api('/chat/visit', { method: 'DELETE', headers: withToken(token) });
