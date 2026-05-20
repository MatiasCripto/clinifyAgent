import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://lngaaaprvsnszepzzszb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuZ2FhYXBydnNuc3plcHp6c3piIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODI3NjMwOCwiZXhwIjoyMDkzODUyMzA4fQ.T1slaeluwVcD_aPDJhk-IjPwmPtZ2Uhiw2VhgfNKzvY',
  { auth: { persistSession: false } }
)

const policies = [
  {
    name: 'Allow upload to patient-documents',
    definition: { name: 'Allow upload to patient-documents', definition: 'bucket_id = \'patient-documents\'', schema: 'storage', table: 'objects', command: 'INSERT', check: 'bucket_id = \'patient-documents\'', roles: ['authenticated'] }
  }
]

// Use REST API directly since we can't run arbitrary SQL via supabase-js
async function main() {
  const API_URL = 'https://lngaaaprvsnszepzzszb.supabase.co'
  const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuZ2FhYXBydnNuc3plcHp6c3piIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODI3NjMwOCwiZXhwIjoyMDkzODUyMzA4fQ.T1slaeluwVcD_aPDJhk-IjPwmPtZ2Uhiw2VhgfNKzvY'

  // Approach: use pg client through Supabase API
  // Actually, let's try the supabase SQL endpoint directly
  const sql = `
DROP POLICY IF EXISTS "Allow upload to patient-documents" ON storage.objects;
CREATE POLICY "Allow upload to patient-documents" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'patient-documents');
DROP POLICY IF EXISTS "Allow read patient-documents" ON storage.objects;
CREATE POLICY "Allow read patient-documents" ON storage.objects FOR SELECT TO public USING (bucket_id = 'patient-documents');
DROP POLICY IF EXISTS "Allow delete own patient-documents" ON storage.objects;
CREATE POLICY "Allow delete own patient-documents" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'patient-documents');
`.trim()

  console.log('Executing SQL...')

  const res = await fetch(`${API_URL}/rest/v1/rpc/pgbouncer_exec`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': KEY,
      'Authorization': `Bearer ${KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    console.error('Failed:', err)
    console.log('\nAlternativa: corré este SQL manualmente en el editor SQL de Supabase:')
    console.log('---')
    console.log(sql)
    console.log('---')
    process.exit(1)
  }

  console.log('Policies created successfully!')
}

main()
