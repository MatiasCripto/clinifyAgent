-- ============================================================
-- OdontoCare SaaS · Migration 003
-- AFIP / ARCA credentials per clinic
-- ============================================================

CREATE TABLE afip_credentials (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id           UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  cuit                TEXT NOT NULL,
  punto_venta         SMALLINT NOT NULL DEFAULT 1,
  sandbox             BOOLEAN NOT NULL DEFAULT TRUE,
  certificate_base64  TEXT,           -- .p12 en base64 (sensible)
  passphrase          TEXT,           -- contraseña del .p12 (sensible)
  has_certificate     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (clinic_id)
);

CREATE TRIGGER trg_afip_credentials_upd
  BEFORE UPDATE ON afip_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE afip_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "afip_credentials_clinic" ON afip_credentials
  FOR ALL USING (
    clinic_id IN (
      SELECT c.id FROM clinics c
      JOIN profiles p ON p.organization_id = c.organization_id
      WHERE p.id = auth.uid()
        AND p.role IN ('owner', 'admin')
    )
  );
