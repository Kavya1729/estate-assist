import { useRequest } from '@/hooks/useRequest';

import { fetchCatalog } from '../api';

let cached = null;

/** One request per page load: the landing cards, chat header and RERA footer share it. */
function loadCatalog() {
  cached ??= fetchCatalog()
    .then((body) => body.items)
    .catch((err) => {
      cached = null;
      throw err;
    });
  return cached;
}

export function useCatalog() {
  const { status, data, error, reload } = useRequest(() => loadCatalog(), []);
  return { status, projects: data ?? [], error, reload };
}
