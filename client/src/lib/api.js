const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const DEFAULT_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Fire-and-forget ping so a sleeping free-tier API starts waking up while the
 * visitor is still reading the page, instead of on their first real request.
 */
export function wakeApi() {
  if (!BASE_URL) return;
  fetch(`${BASE_URL}/api/health`).catch(() => {});
}

export async function api(path, { method = 'GET', body, headers, signal } = {}) {
  const timeout = AbortSignal.timeout(DEFAULT_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${BASE_URL}/api${path}`, {
      method,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    const timedOut = timeout.aborted;
    throw new ApiError(
      0,
      timedOut
        ? 'The server is taking too long to respond. Please try again.'
        : 'Unable to reach the server. Check your connection and try again.',
    );
  }

  const data = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.error ?? 'Something went wrong. Please try again.',
      data?.details,
    );
  }

  return data;
}
