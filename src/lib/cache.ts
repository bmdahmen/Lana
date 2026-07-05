import { getCloudflareContext } from "@opennextjs/cloudflare";

const DEFAULT_TTL_SECONDS = 600;

async function getCache(): Promise<KVNamespace> {
  const { env } = await getCloudflareContext({ async: true });
  return env.CACHE;
}

/**
 * Read-through KV cache for expensive D1 reads. KV's minimum expirationTtl is
 * 60s, so callers should not pass anything shorter than that.
 */
export async function getCached<T>(
  key: string,
  compute: () => Promise<T>,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<T> {
  const cache = await getCache();
  const cached = await cache.get<T>(key, "json");
  if (cached !== null) return cached;

  const value = await compute();
  await cache.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds });
  return value;
}

export async function invalidateCache(...keys: string[]): Promise<void> {
  const cache = await getCache();
  await Promise.all(keys.map((key) => cache.delete(key)));
}

export const CACHE_KEYS = {
  homeDashboard: "home:dashboard",
  accountsList: "accounts:list",
  transactionsDefault: "transactions:default",
} as const;
