import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const envPath = path.resolve(process.cwd(), '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
const env: Record<string, string> = {}
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eqIdx = trimmed.indexOf('=')
  if (eqIdx === -1) continue
  const key = trimmed.slice(0, eqIdx).trim()
  let val = trimmed.slice(eqIdx + 1).trim()
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
  env[key] = val
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_KEY!)

async function main() {
  // 1. Clear Sede Central's evolution_instance
  const { error: e1 } = await sb.from("clinics").update({ evolution_instance: null }).eq("id", "00000000-0000-0000-0000-000000000002")
  console.log("Cleared Sede Central evolution_instance:", e1?.message || "OK")

  // 2. Set clini ursu's evolution_instance
  const { error: e2 } = await sb.from("clinics").update({ evolution_instance: "clinify" }).eq("id", "42b07da0-5db8-4d3e-af5e-6e1680a364a7")
  console.log("Set clini ursu evolution_instance:", e2?.message || "OK")

  // 3. Delete stale wa_conversation for this phone
  const { error: e3 } = await sb.from("wa_conversations").delete().eq("phone", "5491168062699")
  console.log("Deleted stale conversation:", e3?.message || "OK")

  // Verify
  const { data: clinics } = await sb.from("clinics").select("id, name, evolution_instance")
  console.log("\nClinics:", JSON.stringify(clinics, null, 2))
}

main().catch(e => console.error('ERR:', e.message))
