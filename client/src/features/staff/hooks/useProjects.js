import { useRequest } from '@/hooks/useRequest';

import { fetchProjects, fetchSchedule } from '../api';

export const SCHEDULE_DAYS = 7;

/** Both projects with their fact sheets, for the sales head's project screens. */
export const useProjects = () => useRequest(fetchProjects, []);

/** Every slot of one project for a week from `from`, full and blocked ones too. */
export function useSchedule(code, from) {
  return useRequest(
    (signal) => fetchSchedule(code, { from, days: SCHEDULE_DAYS }, signal),
    [code, from],
    { keepPrevious: true },
  );
}
