import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp, parsePositiveInt } from '@/lib/rate-limit'
import type { RateLimitResult } from '@/lib/rate-limit'

// Rate-limit configuration (server-side only; env values are optional).
const GEOCODE_MAX = parsePositiveInt(process.env.RATE_LIMIT_GEOCODE_MAX, 30)
const GEOCODE_WINDOW = parsePositiveInt(process.env.RATE_LIMIT_GEOCODE_WINDOW, 60)
const STRICT = process.env.RATE_LIMIT_STRICT === '1'

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim()
  if (!query) return NextResponse.json({ results: [] })

  // Rate limit before the external Nominatim request, per OSM's usage policy.
  const ip = getClientIp(request)

  let limit: RateLimitResult | null = null
  try {
    limit = await checkRateLimit(`rl:geocode:${ip}`, GEOCODE_MAX, GEOCODE_WINDOW)
  } catch (error) {
    if (STRICT) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again later.' },
        { status: 503 },
      )
    }
    console.warn('Rate limiter unavailable; allowing request.', error)
  }

  if (limit && !limit.allowed) {
    const headers: Record<string, string> = {}
    if (limit.retryAfterSeconds) headers['Retry-After'] = String(limit.retryAfterSeconds)
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers },
    )
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`,
      {
        headers: { 'User-Agent': 'Wastify waste reporting app' },
        next: { revalidate: 300 },
      },
    )
    if (!response.ok) throw new Error(`Geocoding failed with ${response.status}`)

    const results = await response.json()
    return NextResponse.json({
      results: results.map((result: { display_name: string; lat: string; lon: string }) => ({
        address: result.display_name,
        latitude: Number(result.lat),
        longitude: Number(result.lon),
      })),
    })
  } catch (error) {
    console.error('Geocoding request failed:', error)
    return NextResponse.json({ results: [], error: 'Geocoding unavailable' }, { status: 502 })
  }
}
