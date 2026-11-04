import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { useRequest } from '@/hooks/useRequest';

import { fetchExecutives, fetchLeads } from '../api';

export const PAGE_SIZE = 20;

const FILTER_KEYS = [
  'q',
  'temperature',
  'source',
  'status',
  'projectCode',
  'assignedTo',
  'handoff',
  'duplicates',
];

/**
 * Lead list filters live in the URL, so a filtered list survives a refresh,
 * the back button and opening a lead in a new tab.
 */
export function useLeadFilters() {
  const [params, setParams] = useSearchParams();

  const filters = useMemo(
    () => Object.fromEntries(FILTER_KEYS.map((key) => [key, params.get(key) ?? ''])),
    [params],
  );
  const sort = params.get('sort') ?? 'recent';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const activeCount = FILTER_KEYS.filter((key) => filters[key]).length;

  const update = useCallback(
    (patch, { replace = false } = {}) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          Object.entries(patch).forEach(([key, value]) => {
            if (value) next.set(key, String(value));
            else next.delete(key);
          });
          if (!('page' in patch)) next.delete('page');
          return next;
        },
        { replace },
      ),
    [setParams],
  );

  const clear = useCallback(
    () => update(Object.fromEntries(FILTER_KEYS.map((key) => [key, '']))),
    [update],
  );

  return { filters, sort, page, activeCount, update, clear };
}

export function useLeads({ filters, sort, page }) {
  const query = { ...filters, sort, page, limit: PAGE_SIZE };
  return useRequest((signal) => fetchLeads(query, signal), [JSON.stringify(query)], {
    keepPrevious: true,
  });
}

/** The sales head's assign menu and owner filter; executives never load it. */
export function useExecutives(enabled) {
  return useRequest(
    (signal) => (enabled ? fetchExecutives(signal) : Promise.resolve({ items: [] })),
    [enabled],
  );
}
