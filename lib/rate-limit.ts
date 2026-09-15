/**
 * Minimal server-side rate limiter backed by Upstash Redis (REST).
 *
 * Fixed-window implementation: the counter is incremented atomically, and a
 * TTL is applied only when a key is first created (first request in the
 * window), so each window has a fixed duration and keys always expire on
 * their own — the TTL is never extended by later requests.
 */
import { getRedis } from './redis'

/** Upper bound for a single Redis command; keeps slow/unreachable Redis from stalling requests. */
const REDIS_TIMEOUT_MS = 2000

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  /** Seconds until the window resets. Present only when the request is limited. */
  retryAfterSeconds?: number
}

/**
 * Best-effort client IP from the request.
 *
 * Vercel sets X-Forwarded-For on route handlers; the left-most value is the
 * originating client. Falls back to x-real-ip, then 'unknown'.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  return 'unknown'
}

/**
 * Parses an optional env override as a positive integer, falling back when
 * absent or invalid so a misconfigured value can't misbehave rate limiting.
 */
export function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

/**
 * Rate-limits `key` within a fixed window using Redis atomic operations.
 *
 * @param key           unique key (namespace + identifier), e.g. `rl:gemini:1.2.3.4`
 * @param limit         maximum allowed requests per window
 * @param windowSeconds length of the window in seconds
 *
 * Throws if Redis is unavailable or times out, letting callers apply their
 * fail-open / fail-closed policy.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const redis = getRedis()

  // Atomic increment; exactly one caller observes 1 (the first request in the
  // window) and is responsible for setting the TTL.
  const count = await withTimeout(redis.incr(key), REDIS_TIMEOUT_MS)
  if (count === 1) {
    await withTimeout(redis.expire(key, windowSeconds), REDIS_TIMEOUT_MS)
  }

  if (count <= limit) {
    return { allowed: true, remaining: Math.max(0, limit - count) }
  }

  const ttlMillis = await withTimeout(redis.pttl(key), REDIS_TIMEOUT_MS)
  return {
    allowed: false,
    remaining: 0,
    retryAfterSeconds: Math.max(1, Math.ceil(ttlMillis / 1000)),
  }
}

/** Rejects if `promise` does not settle within `ms`. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Redis request timed out.')), ms)
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}