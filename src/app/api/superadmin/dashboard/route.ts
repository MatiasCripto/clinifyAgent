import { NextResponse } from 'next/server'
import { requireSuperadmin } from '../_helpers'

const PLAN_PRICE: Record<string, number> = {
  starter: 29,
  pro: 79,
  enterprise: 199,
}

export async function GET() {
  const admin = await requireSuperadmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const startOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Organizations
  const { data: orgs } = await admin
    .from('organizations')
    .select('id, name, plan, is_active, created_at, settings')

  const allOrgs    = orgs ?? []
  const active     = allOrgs.filter(o => o.is_active).length
  const inactive   = allOrgs.filter(o => !o.is_active).length
  const newThisMonth = allOrgs.filter(o => o.created_at >= startOfMonth).length
  const mrr = allOrgs
    .filter(o => o.is_active)
    .reduce((sum, o) => sum + (PLAN_PRICE[o.plan] ?? 0), 0)

  // Users (profiles)
  const { count: totalUsers } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })

  // WhatsApp bots active (clinics with whatsapp_number set)
  const { count: botsActive } = await admin
    .from('clinics')
    .select('id', { count: 'exact', head: true })
    .not('whatsapp_number', 'is', null)
    .eq('is_active', true)

  // Appointments today
  const { count: appointmentsToday } = await admin
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .gte('starts_at', startOfDay)

  // Automation logs today
  const { count: automationsToday } = await admin
    .from('automation_logs')
    .select('id', { count: 'exact', head: true })
    .gte('executed_at', startOfDay)

  // Failed automations last 7 days
  const { data: failedLogs } = await admin
    .from('automation_logs')
    .select('id, workflow, error, executed_at, clinic_id')
    .eq('status', 'failed')
    .gte('executed_at', sevenDaysAgo)
    .order('executed_at', { ascending: false })
    .limit(5)

  // Support tickets (if table exists, else empty)
  let openTickets = 0
  try {
    const { count } = await admin
      .from('support_tickets')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open')
    openTickets = count ?? 0
  } catch { /* table may not exist yet */ }

  // Plan breakdown
  const planBreakdown = ['starter', 'pro', 'enterprise'].map(plan => ({
    plan,
    count: allOrgs.filter(o => o.is_active && o.plan === plan).length,
    mrr: allOrgs.filter(o => o.is_active && o.plan === plan).length * (PLAN_PRICE[plan] ?? 0),
  }))

  // Recent orgs
  const recentOrgs = allOrgs
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5)

  // Alerts
  const alerts: Array<{ type: string; message: string; severity: 'critical' | 'warning' | 'info' }> = []

  if (inactive > 0) {
    alerts.push({ type: 'suspended', message: `${inactive} cliente${inactive > 1 ? 's' : ''} suspendido${inactive > 1 ? 's' : ''}`, severity: 'warning' })
  }
  if (failedLogs && failedLogs.length > 0) {
    alerts.push({ type: 'automation', message: `${failedLogs.length} automatizacion${failedLogs.length > 1 ? 'es' : ''} fallida${failedLogs.length > 1 ? 's' : ''} en los últimos 7 días`, severity: 'critical' })
  }
  if (openTickets > 0) {
    alerts.push({ type: 'support', message: `${openTickets} ticket${openTickets > 1 ? 's' : ''} de soporte abierto${openTickets > 1 ? 's' : ''}`, severity: 'warning' })
  }

  return NextResponse.json({
    kpis: {
      active,
      inactive,
      total: allOrgs.length,
      newThisMonth,
      mrr,
      totalUsers: totalUsers ?? 0,
      botsActive: botsActive ?? 0,
      openTickets,
    },
    activity: {
      appointmentsToday: appointmentsToday ?? 0,
      automationsToday: automationsToday ?? 0,
    },
    planBreakdown,
    alerts,
    recentOrgs,
  })
}
