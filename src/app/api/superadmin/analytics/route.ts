import { NextResponse } from 'next/server'
import { requireSuperadmin } from '../_helpers'

export async function GET() {
  const admin = await requireSuperadmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const now = new Date()
  const months: Array<{ label: string; start: string; end: string }> = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const e = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    months.push({
      label: d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
      start: d.toISOString(),
      end: e.toISOString(),
    })
  }

  // Orgs by plan
  const { data: orgs } = await admin
    .from('organizations')
    .select('id, plan, is_active, created_at')

  const allOrgs = orgs ?? []

  // Growth: new orgs per month
  const growth = months.map(m => ({
    label: m.label,
    new: allOrgs.filter(o => o.created_at >= m.start && o.created_at < m.end).length,
  }))

  // Plan distribution
  const planDist = ['starter', 'pro', 'enterprise'].map(plan => ({
    plan,
    total: allOrgs.filter(o => o.plan === plan).length,
    active: allOrgs.filter(o => o.plan === plan && o.is_active).length,
  }))

  // Automation logs per month
  const { data: logs } = await admin
    .from('automation_logs')
    .select('status, executed_at')
    .gte('executed_at', months[0].start)

  const logsData = logs ?? []
  const logsPerMonth = months.map(m => ({
    label: m.label,
    success: logsData.filter(l => l.executed_at >= m.start && l.executed_at < m.end && l.status === 'success').length,
    failed: logsData.filter(l => l.executed_at >= m.start && l.executed_at < m.end && l.status === 'failed').length,
  }))

  // Top orgs by appointments
  const { data: appts } = await admin
    .from('appointments')
    .select('clinic_id, clinics!inner(organization_id, organizations!inner(name))')
    .gte('starts_at', months[0].start)

  const apptMap: Record<string, { name: string; count: number }> = {}
  for (const a of appts ?? []) {
    const clinic = a.clinics as unknown as { organization_id: string; organizations: { name: string } }
    const orgId  = clinic?.organization_id
    const name   = clinic?.organizations?.name ?? '?'
    if (orgId) {
      if (!apptMap[orgId]) apptMap[orgId] = { name, count: 0 }
      apptMap[orgId].count++
    }
  }
  const topByAppointments = Object.entries(apptMap)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Automation success rate
  const totalLogs  = logsData.length
  const successLogs = logsData.filter(l => l.status === 'success').length
  const successRate = totalLogs > 0 ? Math.round((successLogs / totalLogs) * 100) : 0

  return NextResponse.json({
    growth,
    planDist,
    logsPerMonth,
    topByAppointments,
    successRate,
    totalLogs,
  })
}
