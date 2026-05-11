export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import { ProfessionalsContent } from './professionals-content'

export const metadata: Metadata = { title: 'Profesionales' }

export default function ProfessionalsPage() {
  return <ProfessionalsContent />
}
