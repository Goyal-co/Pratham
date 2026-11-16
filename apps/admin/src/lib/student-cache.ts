type CacheEntry<T> = { at: number; data: T };

const store = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL = 45_000;

export function studentCacheGet<T>(key: string, ttl = DEFAULT_TTL): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > ttl) {
    store.delete(key);
    return null;
  }
  return hit.data as T;
}

export function studentCacheSet<T>(key: string, data: T) {
  store.set(key, { at: Date.now(), data });
}

export function studentCacheInvalidate(prefix?: string) {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/** Fetch JSON via api(), with a short in-memory TTL across student tabs. */
export async function cachedStudentFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl = DEFAULT_TTL
): Promise<T> {
  if (ttl > 0) {
    const hit = studentCacheGet<T>(key, ttl);
    if (hit) return hit;
  }
  const data = await fetcher();
  studentCacheSet(key, data);
  return data;
}
