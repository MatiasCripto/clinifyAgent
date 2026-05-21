// ── Local dev cron scheduler ─────────────────────────────────
// Optional. Run with: npx tsx scripts/dev-cron.ts
// Pings local API job endpoints on a schedule.
// Disable by not running it. No production impact.

const BASE_URL = process.env.LOCAL_APP_URL ?? 'http://localhost:3000'
const JOB_SECRET = process.env.JOB_SECRET ?? ''

async function trigger(job: string) {
  const url = `${BASE_URL}/api/jobs/${job}`
  try {
    const res = await fetch(url, {
      headers: JOB_SECRET ? { Authorization: `Bearer ${JOB_SECRET}` } : {},
    })
    const data = await res.json()
    const status = res.ok ? 'OK' : 'ERR'
    console.log(`[${new Date().toLocaleTimeString()}] ${status} ${job} →`, JSON.stringify(data))
  } catch (err) {
    console.error(`[${new Date().toLocaleTimeString()}] FAIL ${job} →`, String(err))
  }
}

async function runAll() {
  console.log('\n─── Automation Jobs ───', new Date().toLocaleString())
  await trigger('reminder-24h')
  await trigger('reminder-1h')
  await trigger('post-appointment-nps')
  await trigger('churn-recovery')
  console.log('─── Done ───\n')
}

// Run immediately, then every 15 minutes
runAll()
const interval = setInterval(runAll, 15 * 60 * 1000)

process.on('SIGINT', () => { clearInterval(interval); process.exit(0) })
process.on('SIGTERM', () => { clearInterval(interval); process.exit(0) })
