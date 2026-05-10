import { NextRequest, NextResponse } from 'next/server'
import { sendText } from '@/lib/bot/evolution-client'

export async function POST(req: NextRequest) {
  const { phone, message } = await req.json()

  if (!phone || !message) {
    return NextResponse.json({ error: 'phone and message required' }, { status: 400 })
  }

  try {
    await sendText(phone, message)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
