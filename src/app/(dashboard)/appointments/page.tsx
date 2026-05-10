import type { Metadata } from 'next'
import { AppointmentsContent } from './appointments-content'

export const metadata: Metadata = { title: 'Turnos' }

export default function AppointmentsPage() {
  return <AppointmentsContent />
}
