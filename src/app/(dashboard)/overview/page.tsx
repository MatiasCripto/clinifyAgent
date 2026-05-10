import type { Metadata } from 'next'
import { OverviewContent } from './overview-content'

export const metadata: Metadata = { title: 'Panel principal' }

export default function OverviewPage() {
  return <OverviewContent />
}
