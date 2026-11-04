import { api, ApiError } from '@/lib/api';

import { endStaffSession, staffToken } from './session';

/** Staff calls carry the session token; a 401 means it expired, so the session ends. */
async function staffApi(path, options = {}) {
  try {
    return await api(path, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${staffToken()}` },
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) endStaffSession('expired');
    throw err;
  }
}

const post = (path, body) => staffApi(path, { method: 'POST', body: body ?? {} });
const patch = (path, body) => staffApi(path, { method: 'PATCH', body });

export const login = (credentials) => api('/auth/login', { method: 'POST', body: credentials });

export function fetchLeads(filters, signal) {
  const query = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''),
  );
  return staffApi(`/leads?${query}`, { signal });
}

export const fetchLead = (id, signal) => staffApi(`/leads/${id}`, { signal });

export const fetchExecutives = (signal) => staffApi('/staff/executives', { signal });

export const sendReply = (leadId, text) => post(`/leads/${leadId}/messages`, { text });

export const takeOverChat = (leadId) => post(`/leads/${leadId}/takeover`);

export const handBackChat = (leadId) => post(`/leads/${leadId}/handback`);

export const assignLead = (leadId, executiveId) => post(`/leads/${leadId}/assign`, { executiveId });

export const resolveDuplicate = (leadId, otherId, resolution) =>
  post(`/leads/${leadId}/duplicates/${otherId}`, { resolution });

export const recordVisitOutcome = (visitId, outcome) =>
  post(`/visits/${visitId}/outcome`, { outcome });

export const cancelVisit = (visitId) => post(`/visits/${visitId}/cancel`);

export function fetchDashboard({ from, to }, signal) {
  return staffApi(`/dashboard?${new URLSearchParams({ from, to })}`, { signal });
}

export const fetchDuplicatePairs = (signal) => staffApi('/leads/duplicates', { signal });

export const fetchReviews = (signal) => staffApi('/reviews', { signal });

export const resolveReview = (conversationId) => post(`/reviews/${conversationId}/resolve`);

export const fetchProjects = (signal) => staffApi('/projects', { signal });

export const updateProject = (code, changes) => patch(`/projects/${code}`, changes);

export function fetchSchedule(code, { from, days }, signal) {
  return staffApi(`/projects/${code}/schedule?${new URLSearchParams({ from, days })}`, { signal });
}

export const generateSlots = (code, options) => post(`/projects/${code}/slots`, options);

export const updateSlot = (slotId, changes) => patch(`/slots/${slotId}`, changes);
