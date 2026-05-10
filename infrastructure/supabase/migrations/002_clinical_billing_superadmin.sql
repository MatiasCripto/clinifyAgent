-- ============================================================
-- OdontoCare SaaS · Migration 002
-- Clinical Records, Odontogram, Invoices & Superadmin tables
-- ============================================================

-- ============================================================
-- ODONTOGRAM — TOOTH RECORDS
-- ============================================================

CREATE TABLE tooth_records (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id   UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id    UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  tooth_number SMALLINT NOT NULL CHECK (tooth_number BETWEEN 11 AND 48),
  condition    TEXT NOT NULL DEFAULT 'healthy'
    CHECK (condition IN ('healthy','caries','filled','crown','implant','extracted','root_canal','bridge')),
  notes        TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (patient_id, tooth_number)
);

CREATE INDEX idx_tooth_records_patient ON tooth_records (patient_id);
CREATE INDEX idx_tooth_records_clinic  ON tooth_records (clinic_id);

ALTER TABLE tooth_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tooth_records_clinic" ON tooth_records
  FOR ALL USING (
    clinic_id IN (
      SELECT c.id FROM clinics c
      JOIN profiles p ON p.organization_id = c.organization_id
      WHERE p.id = auth.uid()
    )
  );

-- ============================================================
-- CLINICAL RECORDS — PATIENT HISTORY SESSIONS
-- ============================================================

CREATE TABLE clinical_records (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id       UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id        UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  professional_id  UUID REFERENCES professionals(id) ON DELETE SET NULL,
  session_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  chief_complaint  TEXT,
  diagnosis        TEXT,
  treatment_plan   TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clinical_records_patient ON clinical_records (patient_id, session_date DESC);
CREATE INDEX idx_clinical_records_clinic  ON clinical_records (clinic_id);

ALTER TABLE clinical_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinical_records_clinic" ON clinical_records
  FOR ALL USING (
    clinic_id IN (
      SELECT c.id FROM clinics c
      JOIN profiles p ON p.organization_id = c.organization_id
      WHERE p.id = auth.uid()
    )
  );

CREATE TRIGGER trg_clinical_records_upd
  BEFORE UPDATE ON clinical_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- CLINICAL TREATMENTS — LINE ITEMS WITHIN A SESSION
-- ============================================================

CREATE TABLE clinical_treatments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinical_record_id  UUID NOT NULL REFERENCES clinical_records(id) ON DELETE CASCADE,
  tooth_number        SMALLINT CHECK (tooth_number BETWEEN 11 AND 48),
  description         TEXT NOT NULL,
  amount              NUMERIC(10,2) NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned','in_progress','completed','cancelled')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clinical_treatments_record ON clinical_treatments (clinical_record_id);

ALTER TABLE clinical_treatments ENABLE ROW LEVEL SECURITY;

-- Inherit access via clinical_records
CREATE POLICY "clinical_treatments_via_record" ON clinical_treatments
  FOR ALL USING (
    clinical_record_id IN (
      SELECT cr.id FROM clinical_records cr
      JOIN clinics c ON c.id = cr.clinic_id
      JOIN profiles p ON p.organization_id = c.organization_id
      WHERE p.id = auth.uid()
    )
  );

-- ============================================================
-- INVOICES
-- ============================================================

CREATE TABLE invoices (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id           UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id          UUID REFERENCES patients(id) ON DELETE SET NULL,
  invoice_number      TEXT NOT NULL,
  invoice_type        TEXT NOT NULL DEFAULT 'FC-C'
    CHECK (invoice_type IN ('FC-A','FC-B','FC-C','NC-A','NC-B','ND')),
  invoice_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date            DATE,
  status              TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','paid','overdue','cancelled')),
  currency            TEXT NOT NULL DEFAULT 'ARS'
    CHECK (currency IN ('ARS','USD')),
  subtotal            NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate            NUMERIC(5,2) NOT NULL DEFAULT 21,
  tax_amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  total               NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes               TEXT,
  -- AFIP fields (ready for CAE integration)
  afip_cae            TEXT,
  afip_cae_expiry     DATE,
  afip_punto_venta    SMALLINT DEFAULT 1,
  paid_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (clinic_id, invoice_number)
);

CREATE INDEX idx_invoices_clinic       ON invoices (clinic_id, invoice_date DESC);
CREATE INDEX idx_invoices_patient      ON invoices (patient_id);
CREATE INDEX idx_invoices_status       ON invoices (status);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_clinic" ON invoices
  FOR ALL USING (
    clinic_id IN (
      SELECT c.id FROM clinics c
      JOIN profiles p ON p.organization_id = c.organization_id
      WHERE p.id = auth.uid()
    )
  );

CREATE TRIGGER trg_invoices_upd
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- INVOICE ITEMS
-- ============================================================

CREATE TABLE invoice_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id   UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description  TEXT NOT NULL,
  quantity     NUMERIC(8,2) NOT NULL DEFAULT 1,
  unit_price   NUMERIC(12,2) NOT NULL,
  total        NUMERIC(12,2) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoice_items_invoice ON invoice_items (invoice_id);

ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_items_via_invoice" ON invoice_items
  FOR ALL USING (
    invoice_id IN (
      SELECT i.id FROM invoices i
      JOIN clinics c ON c.id = i.clinic_id
      JOIN profiles p ON p.organization_id = c.organization_id
      WHERE p.id = auth.uid()
    )
  );

-- ============================================================
-- SUPERADMIN — SUBSCRIPTIONS
-- ============================================================

CREATE TABLE subscriptions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan            TEXT NOT NULL DEFAULT 'starter'
    CHECK (plan IN ('starter','pro','enterprise')),
  status          TEXT NOT NULL DEFAULT 'trial'
    CHECK (status IN ('active','trial','suspended','cancelled')),
  price_usd       NUMERIC(8,2) NOT NULL DEFAULT 29,
  period_start    DATE,
  period_end      DATE,
  trial_ends_at   DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id)
);

-- No RLS — superadmin only; service role key is used from API routes

-- ============================================================
-- SUPERADMIN — BILLING RECORDS
-- ============================================================

CREATE TABLE billing_records (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  amount_usd      NUMERIC(8,2) NOT NULL,
  description     TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','overdue','cancelled')),
  due_date        DATE,
  paid_at         TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SUPERADMIN — SUPPORT TICKETS
-- ============================================================

CREATE TABLE support_tickets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  subject         TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_progress','closed')),
  priority        TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low','medium','high','critical')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SUPERADMIN — FEATURE FLAGS
-- ============================================================

CREATE TABLE feature_flags (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default flags
INSERT INTO feature_flags (key, name, description, enabled) VALUES
  ('ai_chat',           'Chat IA',              'Habilita el asistente de IA en el chat',       FALSE),
  ('whatsapp_bot',      'Bot WhatsApp',         'Activa el bot de turnos por WhatsApp',          TRUE),
  ('electronic_invoice','Factura Electrónica',  'Integración AFIP para CAE',                     FALSE),
  ('analytics_v2',      'Analytics v2',         'Nueva versión del módulo de analíticas',        FALSE),
  ('patient_portal',    'Portal del Paciente',  'Acceso web para que el paciente vea sus turnos',FALSE)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- SUPERADMIN — API KEYS (external services)
-- ============================================================

CREATE TABLE api_keys (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service      TEXT NOT NULL,
  label        TEXT NOT NULL,
  masked_value TEXT NOT NULL,
  raw_value    TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SUPERADMIN — PLATFORM CONFIG (key/value store)
-- ============================================================

CREATE TABLE platform_config (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key        TEXT NOT NULL UNIQUE,
  value      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default config
INSERT INTO platform_config (key, value) VALUES
  ('support_email',       'soporte@odontocare.com'),
  ('max_clinics_starter', '1'),
  ('max_clinics_pro',     '3'),
  ('max_clinics_enterprise', '999'),
  ('afip_environment',    'sandbox')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- TRIGGERS for updated_at on new superadmin tables
-- ============================================================

CREATE TRIGGER trg_subscriptions_upd    BEFORE UPDATE ON subscriptions     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_billing_records_upd  BEFORE UPDATE ON billing_records   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_support_tickets_upd  BEFORE UPDATE ON support_tickets   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_feature_flags_upd    BEFORE UPDATE ON feature_flags     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_api_keys_upd         BEFORE UPDATE ON api_keys          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_platform_config_upd  BEFORE UPDATE ON platform_config   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
