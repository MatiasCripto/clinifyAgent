import { NextRequest, NextResponse } from 'next/server'

const BASE_URL = process.env.EVOLUTION_API_URL ?? 'http://localhost:8080'
const API_KEY  = process.env.EVOLUTION_API_KEY  ?? ''
const DEFAULT_INSTANCE = process.env.EVOLUTION_INSTANCE ?? 'clinify'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const instance: string = body.instance ?? DEFAULT_INSTANCE

  try {
    await fetch(`${BASE_URL}/instance/logout/${instance}`, {
      method: 'DELETE',
      headers: { apikey: API_KEY },
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error al desconectar' }, { status: 502 })
  }
}
