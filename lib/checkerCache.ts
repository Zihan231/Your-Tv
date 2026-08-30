export interface CacheEntry {
  status: 'alive' | 'dead' | 'unknown' | 'checking';
  checkedAt: number;
}

export function readCache(statusMap: Record<string, 'alive' | 'dead' | 'unknown' | 'checking'>): Record<string, 'alive' | 'dead' | 'unknown' | 'checking'> {
  if (typeof window === 'undefined') return statusMap;

  try {
    const raw = localStorage.getItem('iptv_status_cache');
    if (!raw) return statusMap;

    const entries = JSON.parse(raw) as Record<string, { status: 'alive' | 'dead' | 'unknown' | 'checking'; checkedAt: number }>;
    const now = Date.now();

    const filtered: Record<string, { status: 'alive' | 'dead' | 'unknown' | 'checking'; checkedAt: number }> = {};
    for (const [url, entry] of Object.entries(entries)) {
      if (now - entry.checkedAt < 30 * 60 * 1000) {
        filtered[url] = entry;
        statusMap[url] = entry.status;
      }
    }
    // Write back filtered cache
    localStorage.setItem('iptv_status_cache', JSON.stringify(filtered));
  } catch {
    /* ignore localStorage errors */
  }
  return statusMap;
}

export function writeCache(statusMap: Record<string, 'alive' | 'dead' | 'unknown' | 'checking'>): void {
  if (typeof window === 'undefined') return;

  try {
    const entries: Record<string, { status: 'alive' | 'dead' | 'unknown' | 'checking'; checkedAt: number }> = {};
    for (const [url, status] of Object.entries(statusMap)) {
      // only cache non-unknown statuses
      if (status !== 'unknown' && status !== 'checking') {
        entries[url] = { status, checkedAt: Date.now() };
      }
    }
    localStorage.setItem('iptv_status_cache', JSON.stringify(entries));
  } catch {
    /* ignore localStorage errors */
  }
}