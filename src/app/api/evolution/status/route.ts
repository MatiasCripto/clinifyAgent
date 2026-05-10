import { NextRequest, NextResponse } from 'next/server'

const BASE_URL = process.env.EVOLUTION_API_URL ?? 'http://localhost:8080'
const API_KEY  = process.env.EVOLUTION_API_KEY  ?? ''
const DEFAULT_INSTANCE = process.env.EVOLUTION_INSTANCE ?? 'clinify'

export async function GET(req: NextRequest) {
  const instance = req.nextUrl.searchParams.get('instance') ?? DEFAULT_INSTANCE
  try {
    const res = await fetch(`${BASE_URL}/instance/connectionState/${instance}`, {
      headers: { apikey: API_KEY },
      cache: 'no-store',
    })
    if (!res.ok) return NextResponse.json({ state: 'close' })
    const data = await res.json()
    // Evolution v2: { instance: { instanceName, state } }
    const state: string = data?.instance?.state ?? data?.state ?? 'close'
    return NextResponse.json({ state, instance })
  } catch {
    return NextResponse.json({ state: 'close', instance })
  }
}
