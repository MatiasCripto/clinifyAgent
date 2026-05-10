import { NextRequest, NextResponse } from 'next/server'

const BASE_URL = process.env.EVOLUTION_API_URL ?? 'http://localhost:8080'
const API_KEY  = process.env.EVOLUTION_API_KEY  ?? ''
const DEFAULT_INSTANCE = process.env.EVOLUTION_INSTANCE ?? 'clinify'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const instance: string = body.instance ?? DEFAULT_INSTANCE

  // 1. Try to connect existing instance → returns QR if not yet connected
  const connectRes = await fetch(`${BASE_URL}/instance/connect/${instance}`, {
    headers: { apikey: API_KEY },
    cache: 'no-store',
  })

  if (connectRes.ok) {
    const data = await connectRes.json()
    // If already open: { instance: { state: 'open' } }
    // If needs QR:     { base64: 'data:image/png;...', code: '2@...' }
    return NextResponse.json(data)
  }

  // 2. Instance doesn't exist → create it
  const createRes = await fetch(`${BASE_URL}/instance/create`, {
    method: 'POST',
    headers: { apikey: API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instanceName: instance,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    }),
  })

  if (!createRes.ok) {
    return NextResponse.json({ error: 'No se pudo crear la instancia' }, { status: 502 })
  }

  const created = await createRes.json()
  return NextResponse.json(created)
}
