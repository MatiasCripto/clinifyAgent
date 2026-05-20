-- SEC-4: Restrict patient-documents reads to authenticated users only.
-- Replaces the public read policy with authenticated-only.
-- Bucket stays public=true so getPublicUrl() still works client-side,
-- but RLS on storage.objects blocks unauthenticated access.

DROP POLICY IF EXISTS "Allow read patient-documents" ON storage.objects;

CREATE POLICY "Allow read patient-documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'patient-documents');
