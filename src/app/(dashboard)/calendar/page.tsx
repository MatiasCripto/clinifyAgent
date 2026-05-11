export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import { CalendarContent } from './calendar-content'

export const metadata: Metadata = { title: 'Calendario' }

export default function CalendarPage() {
  return <CalendarContent />
}
