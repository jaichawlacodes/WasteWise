'use client';

/**
 * Tiny in-memory client-side cache for server-action calls that pages
 * issue on every mount (e.g. getUserByEmail, getHeaderData).
 *
 * Sharing a single cache across page components means navigating between
 * pages does NOT re-issue the same query until the cache TTL expires or
 * the entry is invalidated.
 */

type Entry<T> = { value: T; expiresAt: number };

const store = new Map<string, Entry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();
const DEFAULT_TTL_MS = 30_000;

export async function cachedCall<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expiresAt > now) {
    return hit.value;
  }
  const pending = inFlight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = fetcher()
    .then((value) => {
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
      inFlight.delete(key);
      return value;
    })
    .catch((err) => {
      inFlight.delete(key);
      throw err;
    });
  inFlight.set(key, promise);
  return promise;
}

export function invalidateCache(keyPrefix?: string) {
  if (!keyPrefix) {
    store.clear();
    inFlight.clear();
    return;
  }
  Array.from(store.keys()).forEach((key) => {
    if (key.startsWith(keyPrefix)) store.delete(key);
  });
  Array.from(inFlight.keys()).forEach((key) => {
    if (key.startsWith(keyPrefix)) inFlight.delete(key);
  });
}
