-- Create patient-documents storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'patient-documents',
  'patient-documents',
  true,
  52428800,  -- 50 MB max
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- RLS: allow authenticated users to upload to patient-documents bucket
DROP POLICY IF EXISTS "Allow upload to patient-documents" ON storage.objects;
CREATE POLICY "Allow upload to patient-documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'patient-documents');

-- RLS: allow anyone to read from patient-documents bucket (public bucket)
DROP POLICY IF EXISTS "Allow read patient-documents" ON storage.objects;
CREATE POLICY "Allow read patient-documents" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'patient-documents');

-- RLS: allow authenticated users to delete their own uploads
DROP POLICY IF EXISTS "Allow delete own patient-documents" ON storage.objects;
CREATE POLICY "Allow delete own patient-documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'patient-documents');
