import { useRequest } from '@/hooks/useRequest';

import { fetchDuplicatePairs, fetchReviews } from '../api';

/** Chats with replies the guardrails stopped, waiting for a person to check them. */
export const useReviews = () => useRequest(fetchReviews, []);

/** Open possible-duplicate flags as side-by-side pairs. */
export const useDuplicatePairs = () => useRequest(fetchDuplicatePairs, []);
