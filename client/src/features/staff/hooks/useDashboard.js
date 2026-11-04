import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

import { useRequest } from '@/hooks/useRequest';
import { istDateKey } from '@/lib/format';

import { fetchDashboard } from '../api';

const DAY_MS = 86_400_000;

export const RANGES = [
  { key: '7', label: '7 days' },
  { key: '30', label: '30 days' },
  { key: '90', label: '90 days' },
  { key: 'month', label: 'This month' },
];

/** IST calendar dates for a preset, worked out when the request is made. */
function datesFor(range) {
  const now = Date.now();
  const to = istDateKey(now);
  if (range === 'month') return { from: `${to.slice(0, 8)}01`, to };
  return { from: istDateKey(now - (Number(range) - 1) * DAY_MS), to };
}

export function useDashboard() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('range');
  const range = RANGES.some((r) => r.key === requested) ? requested : '30';

  const setRange = useCallback(
    (key) => setParams(key === '30' ? {} : { range: key }, { replace: true }),
    [setParams],
  );

  const request = useRequest((signal) => fetchDashboard(datesFor(range), signal), [range]);
  return { ...request, range, setRange };
}
