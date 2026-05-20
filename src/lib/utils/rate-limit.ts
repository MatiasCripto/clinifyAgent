// Minimal in-memory rate limiter for serverless environments.
// Per-instance ceiling — Vercel cold starts reset the map.
// Sufficient for basic abuse prevention. Not suitable for high-scale production.

const hits = new Map<string, { count: number; resetAt: number }>()

const CLEANUP_INTERVAL = 60_000
let lastCleanup = 0

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  for (const [key, entry] of hits) {
    if (now > entry.resetAt) hits.delete(key)
  }
}

export interface RateLimitOptions {
  windowMs: number  // time window in milliseconds
  maxHits: number   // max requests per window
}

export function checkRateLimit(key: string, options: RateLimitOptions): { allowed: boolean; remaining: number } {
  cleanup()
  const now = Date.now()
  const entry = hits.get(key)

  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + options.windowMs })
    return { allowed: true, remaining: options.maxHits - 1 }
  }

  entry.count++
  if (entry.count > options.maxHits) {
    return { allowed: false, remaining: 0 }
  }

  return { allowed: true, remaining: options.maxHits - entry.count }
}
