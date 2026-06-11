-- ============================================================
-- OdontoCare SaaS · Migration 018
-- RLS for WhatsApp bot tables + fix weekly_schedules & service_areas
-- ============================================================

-- ============================================================
-- 1. wa_conversations — add organization_id for RLS
-- ============================================================

ALTER TABLE wa_conversations ADD COLUMN organization_id UUID REFERENCES organizations(id);

-- Backfill existing rows by matching phone to patients
UPDATE wa_conversations
SET organization_id = patients.organization_id
FROM patients
WHERE patients.phone = wa_conversations.phone;

-- Make it NOT NULL after backfill
ALTER TABLE wa_conversations ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX idx_wa_conversations_org ON wa_conversations (organization_id);

ALTER TABLE wa_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_conversations_org_select" ON wa_conversations
  FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "wa_conversations_org_insert" ON wa_conversations
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "wa_conversations_org_update" ON wa_conversations
  FOR UPDATE TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "wa_conversations_org_delete" ON wa_conversations
  FOR DELETE TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

-- ============================================================
-- 2. wa_messages — RLS via wa_conversations → organization
-- ============================================================

ALTER TABLE wa_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_messages_org_select" ON wa_messages
  FOR SELECT TO authenticated
  USING (conversation_id IN (
    SELECT id FROM wa_conversations WHERE organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  ));

CREATE POLICY "wa_messages_org_insert" ON wa_messages
  FOR INSERT TO authenticated
  WITH CHECK (conversation_id IN (
    SELECT id FROM wa_conversations WHERE organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  ));

CREATE POLICY "wa_messages_org_update" ON wa_messages
  FOR UPDATE TO authenticated
  USING (conversation_id IN (
    SELECT id FROM wa_conversations WHERE organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  ));

CREATE POLICY "wa_messages_org_delete" ON wa_messages
  FOR DELETE TO authenticated
  USING (conversation_id IN (
    SELECT id FROM wa_conversations WHERE organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  ));

-- ============================================================
-- 3. weekly_schedules — RLS via clinic_id → organization
-- ============================================================

CREATE POLICY "weekly_schedules_org_select" ON weekly_schedules
  FOR SELECT TO authenticated
  USING (clinic_id IN (
    SELECT id FROM clinics WHERE organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  ));

CREATE POLICY "weekly_schedules_org_insert" ON weekly_schedules
  FOR INSERT TO authenticated
  WITH CHECK (clinic_id IN (
    SELECT id FROM clinics WHERE organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  ));

CREATE POLICY "weekly_schedules_org_update" ON weekly_schedules
  FOR UPDATE TO authenticated
  USING (clinic_id IN (
    SELECT id FROM clinics WHERE organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  ));

CREATE POLICY "weekly_schedules_org_delete" ON weekly_schedules
  FOR DELETE TO authenticated
  USING (clinic_id IN (
    SELECT id FROM clinics WHERE organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  ));

-- ============================================================
-- 4. service_areas — RLS via professional_id → organization
-- ============================================================

CREATE POLICY "service_areas_org_select" ON service_areas
  FOR SELECT TO authenticated
  USING (professional_id IN (
    SELECT id FROM professionals WHERE organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  ));

CREATE POLICY "service_areas_org_insert" ON service_areas
  FOR INSERT TO authenticated
  WITH CHECK (professional_id IN (
    SELECT id FROM professionals WHERE organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  ));

CREATE POLICY "service_areas_org_update" ON service_areas
  FOR UPDATE TO authenticated
  USING (professional_id IN (
    SELECT id FROM professionals WHERE organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  ));

CREATE POLICY "service_areas_org_delete" ON service_areas
  FOR DELETE TO authenticated
  USING (professional_id IN (
    SELECT id FROM professionals WHERE organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  ));
