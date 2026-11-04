const WEB_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Parses a comma-separated list of browser origins (`https://app.example.com`).
 * Entries with a path, query or another protocol are reported as invalid, since
 * the browser's Origin header never contains them and they would never match.
 */
export function parseOriginList(value) {
  const origins = new Set();
  const invalid = [];

  for (const entry of value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)) {
    const bare = entry.replace(/\/$/, '').toLowerCase();
    let url;
    try {
      url = new URL(bare);
    } catch {
      invalid.push(entry);
      continue;
    }
    if (WEB_PROTOCOLS.has(url.protocol) && url.origin === bare) origins.add(url.origin);
    else invalid.push(entry);
  }

  return { origins: [...origins], invalid };
}
