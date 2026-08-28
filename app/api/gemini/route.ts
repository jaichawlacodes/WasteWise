import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextResponse } from 'next/server'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.NEXT_PUBLIC_GEMINI_API_KEY
  if (!apiKey) throw new Error('Gemini API key is not configured.')

  const genAI = new GoogleGenerativeAI(apiKey)
  return genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL ?? process.env.NEXT_PUBLIC_GEMINI_MODEL ?? 'gemini-3.6-flash',
  })
}

export async function POST(request: Request) {
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
