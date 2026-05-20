-- Patient documents storage
CREATE TABLE IF NOT EXISTS public.patient_documents (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id      uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  file_url        text NOT NULL,
  file_name       text NOT NULL,
  file_type       text NOT NULL DEFAULT 'application/octet-stream',
  uploaded_by     uuid REFERENCES public.profiles(id),
  uploaded_at     timestamptz NOT NULL DEFAULT now(),
  is_deleted      boolean NOT NULL DEFAULT false,
  deleted_by      uuid REFERENCES public.profiles(id),
  deleted_at      timestamptz
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_patient_docs_patient ON public.patient_documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_docs_org     ON public.patient_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_patient_docs_deleted ON public.patient_documents(is_deleted) WHERE is_deleted = false;

-- RLS
ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;

-- Policy: org members can view documents of their org
DROP POLICY IF EXISTS "Org members view documents" ON public.patient_documents;
CREATE POLICY "Org members view documents" ON public.patient_documents
  FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ) AND is_deleted = false);

-- Policy: org members can insert documents
DROP POLICY IF EXISTS "Org members insert documents" ON public.patient_documents;
CREATE POLICY "Org members insert documents" ON public.patient_documents
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ));

-- Policy: org members can soft-delete documents
DROP POLICY IF EXISTS "Org members update documents" ON public.patient_documents;
CREATE POLICY "Org members update documents" ON public.patient_documents
  FOR UPDATE TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ));
