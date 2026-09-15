import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp, parsePositiveInt } from '@/lib/rate-limit'
import type { RateLimitResult } from '@/lib/rate-limit'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

// Rate-limit configuration (server-side only; env values are optional).
const GEMINI_MAX = parsePositiveInt(process.env.RATE_LIMIT_GEMINI_MAX, 10)
const GEMINI_WINDOW = parsePositiveInt(process.env.RATE_LIMIT_GEMINI_WINDOW, 60)
const GEMINI_HOURLY_MAX = parsePositiveInt(process.env.RATE_LIMIT_GEMINI_HOURLY_MAX, 120)
const GEMINI_HOURLY_WINDOW = parsePositiveInt(process.env.RATE_LIMIT_GEMINI_HOURLY_WINDOW, 3600)
const STRICT = process.env.RATE_LIMIT_STRICT === '1'

// 429 with a safe message and, where possible, a Retry-After hint.
function rateLimited(retryAfterSeconds?: number) {
  const headers: Record<string, string> = {}
  if (retryAfterSeconds) headers['Retry-After'] = String(retryAfterSeconds)
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    { status: 429, headers },
  )
}

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.NEXT_PUBLIC_GEMINI_API_KEY
  if (!apiKey) throw new Error('Gemini API key is not configured.')

  const genAI = new GoogleGenerativeAI(apiKey)
  return genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL ?? process.env.NEXT_PUBLIC_GEMINI_MODEL ?? 'gemini-3.6-flash',
  })
}

export async function POST(request: Request) {
  // Rate limiting runs before any expensive Gemini work so blocked requests
  // never reach the model.
  const ip = getClientIp(request)

  let burst: RateLimitResult | null = null
  let hourly: RateLimitResult | null = null
  try {
    burst = await checkRateLimit(`rl:gemini:${ip}`, GEMINI_MAX, GEMINI_WINDOW)
    hourly = await checkRateLimit(`rl:gemini:${ip}:hourly`, GEMINI_HOURLY_MAX, GEMINI_HOURLY_WINDOW)
  } catch (error) {
    if (STRICT) {
      // Fail closed: refuse rather than allow unbounded model spend.
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again later.' },
        { status: 503 },
      )
    }
    // Fail open by default: Redis is an availability tool, not a dependency.
    console.warn('Rate limiter unavailable; allowing request.', error)
  }

  if (burst && !burst.allowed) return rateLimited(burst.retryAfterSeconds)
  if (hourly && !hourly.allowed) return rateLimited(hourly.retryAfterSeconds)

  try {
    const contentType = request.headers.get('content-type') ?? ''
    const model = getModel()

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file')
      const prompt = formData.get('prompt')

      if (!(file instanceof File) || typeof prompt !== 'string') {
        return NextResponse.json({ error: 'An image file and prompt are required.' }, { status: 400 })
      }
      if (!allowedImageTypes.has(file.type)) {
        return NextResponse.json({ error: 'Unsupported image type.' }, { status: 400 })
      }
      if (file.size > MAX_IMAGE_BYTES) {
        return NextResponse.json({ error: 'Image must be 10MB or smaller.' }, { status: 413 })
      }

      const imageData = Buffer.from(await file.arrayBuffer()).toString('base64')
      const result = await model.generateContent([
        prompt,
        { inlineData: { data: imageData, mimeType: file.type } },
      ])
      return NextResponse.json({ text: result.response.text() })
    }

    const body = await request.json()
    if (typeof body?.prompt !== 'string' || !body.prompt.trim()) {
      return NextResponse.json({ error: 'A prompt is required.' }, { status: 400 })
    }

    const result = await model.generateContent(body.prompt)
    return NextResponse.json({ text: result.response.text() })
  } catch (error) {
    console.error('Gemini request failed:', error)
    return NextResponse.json({ error: 'Gemini request failed.' }, { status: 502 })
  }
}
