/**
 * Server-side Redis client (Upstash REST).
 *
 * @upstash/redis talks to Upstash over HTTP(S), so no persistent TCP
 * connection is created — this is what makes it safe on Vercel serverless.
 * A single module-level singleton is created lazily on first use and shared
 * across calls within a serverless instance.
 *
 * Credentials come from server-only environment variables and are never
 * exposed to the client bundle (there are no NEXT_PUBLIC_* variants).
 */
import { Redis } from '@upstash/redis'

let redis: Redis | null = null

/**
 * Returns the lazily-created module-level Redis singleton.
 *
 * Throws if the Redis environment variables are not configured, so callers
 * can apply their own fail-open/fail-closed policy. The message only names the
 * missing variables — it never contains their values.
 */
export function getRedis(): Redis {
  if (redis) return redis

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    throw new Error('Redis is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.')
  }

  redis = new Redis({ url, token })
  return redis
}