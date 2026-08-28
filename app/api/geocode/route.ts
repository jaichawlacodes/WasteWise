import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim()
  if (!query) return NextResponse.json({ results: [] })

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
