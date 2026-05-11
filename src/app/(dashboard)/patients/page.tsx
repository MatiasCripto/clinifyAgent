export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import { PatientsContent } from './patients-content'

export const metadata: Metadata = { title: 'Pacientes' }

export default function PatientsPage() {
  return <PatientsContent />
}
