import { useEffect } from 'react';

import { useRequest } from '@/hooks/useRequest';

import { fetchLead } from '../api';

const POLL_MS = 15_000;

/** The lead with its chats, visits and outbox; refreshed in the background so new buyer messages show up. */
export function useLeadDetail(id) {
  const request = useRequest((signal) => fetchLead(id, signal), [id]);
  const { status, refresh } = request;

  useEffect(() => {
    if (status !== 'ready') return undefined;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [status, refresh]);

  return request;
}
