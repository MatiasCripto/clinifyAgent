export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import { SettingsContent } from './settings-content'

export const metadata: Metadata = { title: 'ConfiguraciÃ³n â€” Clinify' }

export default function SettingsPage() {
  return <SettingsContent />
}
