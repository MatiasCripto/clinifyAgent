export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import { BillingDashboard } from './billing-content'

export const metadata: Metadata = { title: 'Facturacion' }

export default function BillingPage() {
  return <BillingDashboard />
}
