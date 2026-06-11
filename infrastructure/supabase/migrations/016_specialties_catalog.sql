-- Specialties catalog with artifact type mapping
CREATE TABLE IF NOT EXISTS specialties (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  artifact_type   text NULL,
  is_default      boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_specialties_org ON specialties(organization_id);
CREATE INDEX IF NOT EXISTS idx_specialties_default ON specialties(is_default) WHERE is_default = true;

-- RLS
ALTER TABLE specialties ENABLE ROW LEVEL SECURITY;

-- Policies: default specialties visible to all, custom only to org
CREATE POLICY "Default specialties visible to all" ON specialties
  FOR SELECT TO authenticated
  USING (is_default = true OR organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Org members can manage custom specialties" ON specialties
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ) AND is_default = false);

CREATE POLICY "Org members can update custom specialties" ON specialties
  FOR UPDATE TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ) AND is_default = false);

CREATE POLICY "Org members can delete custom specialties" ON specialties
  FOR DELETE TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ) AND is_default = false);

-- Seed default specialties
INSERT INTO specialties (name, artifact_type, is_default) VALUES
  ('Odontología',    'odontograma',  true),
  ('Dermatología',   'dermatologia', true),
  ('Kinesiología',   'kinesiologia', true),
  ('Oftalmología',   'oftalmologia', true),
  ('Traumatología',  'traumatologia', true),
  ('Ginecología',    'ginecologia',  true),
  ('Psicología',     'psicologia',   true),
  ('Nutrición',      'nutricion',    true),
  ('Pediatría',      'pediatria',    true),
  ('Cardiología',    null,           true),
  ('Neurología',     null,           true),
  ('Endocrinología', 'endocrinologia', true),
  ('Fonoaudiología', null,           true)
ON CONFLICT DO NOTHING;
