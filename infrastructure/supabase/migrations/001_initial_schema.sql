-- ============================================================
-- OdontoCare SaaS · Migration 001 · Initial Schema
-- Multi-tenant architecture: organization → clinic → branch
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TENANCY LAYER
-- ============================================================

-- Organizations (top-level tenant: a dental group / company)
CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  logo_url    TEXT,
  plan        TEXT NOT NULL DEFAULT 'starter', -- starter | pro | enterprise
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  settings    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Clinics (branches within an organization)
CREATE TABLE clinics (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  address         TEXT,
  phone           TEXT,
  whatsapp_number TEXT,              -- The WA number this clinic uses
  timezone        TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  settings        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- USER MANAGEMENT
-- ============================================================

-- Profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name       TEXT NOT NULL,
  avatar_url      TEXT,
  role            TEXT NOT NULL DEFAULT 'staff', -- owner | admin | staff | viewer
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Profile ↔ Clinic access (a staff member can work in multiple branches)
CREATE TABLE profile_clinics (
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  clinic_id  UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'staff',
  PRIMARY KEY (profile_id, clinic_id)
);

-- ============================================================
-- SPECIALTIES & PROFESSIONALS
-- ============================================================

CREATE TABLE specialties (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  color           TEXT NOT NULL DEFAULT '#6366f1',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE professionals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name       TEXT NOT NULL,
  specialty_id    UUID REFERENCES specialties(id) ON DELETE SET NULL,
  phone           TEXT,
  email           TEXT,
  avatar_url      TEXT,
  color           TEXT NOT NULL DEFAULT '#6366f1',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  bio             TEXT,
  license_number  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A professional can work in multiple clinics
CREATE TABLE professional_clinics (
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  PRIMARY KEY (professional_id, clinic_id)
);

-- ============================================================
-- AVAILABILITY TEMPLATES
-- Defines the weekly recurring schedule of a professional
-- ============================================================

CREATE TABLE availability_templates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  day_of_week     SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  slot_duration   SMALLINT NOT NULL DEFAULT 30, -- minutes
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (professional_id, clinic_id, day_of_week, start_time)
);

-- Blocked periods (vacations, personal time, etc.)
CREATE TABLE availability_blocks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ NOT NULL,
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PATIENTS
-- ============================================================

CREATE TABLE patients (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  dni             TEXT,                -- National ID
  phone           TEXT NOT NULL,       -- WhatsApp source of truth
  email           TEXT,
  date_of_birth   DATE,
  gender          TEXT,               -- male | female | other
  address         TEXT,
  notes           TEXT,               -- Medical notes / allergies
  whatsapp_id     TEXT,               -- WA contact ID from Evolution API
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, phone)
);

-- ============================================================
-- APPOINTMENTS
-- ============================================================

CREATE TYPE appointment_status AS ENUM (
  'pending',
  'confirmed',
  'cancelled',
  'absent',     -- no-show
  'completed'
);

CREATE TABLE appointments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ NOT NULL,
  treatment       TEXT NOT NULL,
  status          appointment_status NOT NULL DEFAULT 'pending',
  notes           TEXT,
  cancellation_reason TEXT,
  reminder_sent   BOOLEAN NOT NULL DEFAULT FALSE,
  nps_sent        BOOLEAN NOT NULL DEFAULT FALSE,
  google_event_id TEXT,               -- Google Calendar sync
  source          TEXT DEFAULT 'whatsapp', -- whatsapp | manual | web
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for calendar queries (most frequent)
CREATE INDEX idx_appointments_clinic_starts ON appointments (clinic_id, starts_at);
CREATE INDEX idx_appointments_patient ON appointments (patient_id);
CREATE INDEX idx_appointments_professional ON appointments (professional_id);
CREATE INDEX idx_appointments_status ON appointments (status);

-- ============================================================
-- WHATSAPP CONVERSATIONS
-- ============================================================

CREATE TABLE conversations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID REFERENCES patients(id) ON DELETE SET NULL,
  wa_contact_id   TEXT NOT NULL,      -- WA phone/contact identifier
  wa_chat_id      TEXT NOT NULL,      -- WA chat identifier
  status          TEXT NOT NULL DEFAULT 'open', -- open | closed | bot
  last_message_at TIMESTAMPTZ,
  context         JSONB NOT NULL DEFAULT '{}',  -- Bot conversation state
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (clinic_id, wa_chat_id)
);

CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE message_type AS ENUM ('text', 'image', 'audio', 'video', 'document', 'template');

CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  wa_message_id   TEXT,               -- WA native message ID (for dedup)
  direction       message_direction NOT NULL,
  type            message_type NOT NULL DEFAULT 'text',
  body            TEXT,
  media_url       TEXT,
  intent          TEXT,               -- AI classified intent
  intent_confidence FLOAT,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wa_message_id)
);

CREATE INDEX idx_messages_conversation ON messages (conversation_id, sent_at DESC);

-- ============================================================
-- NPS
-- ============================================================

CREATE TABLE nps_responses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id  UUID REFERENCES appointments(id) ON DELETE SET NULL,
  score           SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 10),
  comment         TEXT,
  segment         TEXT GENERATED ALWAYS AS (
    CASE
      WHEN score >= 9 THEN 'promoter'
      WHEN score >= 7 THEN 'neutral'
      ELSE 'detractor'
    END
  ) STORED,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_nps_clinic ON nps_responses (clinic_id, created_at DESC);

-- ============================================================
-- ANALYTICS / BUSINESS INTELLIGENCE
-- ============================================================

-- Patient behavioral scores (computed & cached by n8n daily)
CREATE TABLE patient_scores (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id          UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id           UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  -- Attendance Score
  attendance_rate     FLOAT NOT NULL DEFAULT 1.0,   -- 0.0 to 1.0
  total_appointments  INT NOT NULL DEFAULT 0,
  cancelled_count     INT NOT NULL DEFAULT 0,
  absent_count        INT NOT NULL DEFAULT 0,
  -- RFM
  recency_days        INT,        -- days since last appointment
  frequency_count     INT,        -- appointments in last 12 months
  monetary_value      NUMERIC(10,2), -- estimated total spend
  rfm_segment         TEXT,       -- champion | loyal | at_risk | new | dormant | lost
  -- Churn
  churn_risk          TEXT,       -- low | medium | high | churned
  churn_probability   FLOAT,      -- 0.0 to 1.0
  -- LTV
  ltv_estimated       NUMERIC(10,2),
  avg_ticket          NUMERIC(10,2),
  -- Labels (computed)
  behavior_label      TEXT,       -- e.g. "Paciente leal", "Cancela frecuente"
  computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (patient_id, clinic_id)
);

-- Daily analytics snapshots (for charts/BI)
CREATE TABLE analytics_daily (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id           UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  date                DATE NOT NULL,
  total_appointments  INT NOT NULL DEFAULT 0,
  confirmed_count     INT NOT NULL DEFAULT 0,
  cancelled_count     INT NOT NULL DEFAULT 0,
  absent_count        INT NOT NULL DEFAULT 0,
  completed_count     INT NOT NULL DEFAULT 0,
  new_patients        INT NOT NULL DEFAULT 0,
  nps_avg             FLOAT,
  promoter_count      INT NOT NULL DEFAULT 0,
  detractor_count     INT NOT NULL DEFAULT 0,
  revenue_estimated   NUMERIC(10,2),
  UNIQUE (clinic_id, date)
);

CREATE INDEX idx_analytics_daily_clinic ON analytics_daily (clinic_id, date DESC);

-- ============================================================
-- AUTOMATION LOGS
-- ============================================================

CREATE TABLE automation_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id   UUID REFERENCES clinics(id) ON DELETE SET NULL,
  workflow    TEXT NOT NULL,       -- n8n workflow name
  entity_type TEXT,               -- appointment | patient | conversation
  entity_id   UUID,
  status      TEXT NOT NULL,      -- success | failed | skipped
  payload     JSONB,
  error       TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE nps_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_daily ENABLE ROW LEVEL SECURITY;

-- Profiles can read their own organization
CREATE POLICY "profiles_own_org" ON organizations
  FOR SELECT USING (
    id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Clinics: accessible by organization members
CREATE POLICY "clinics_org_members" ON clinics
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Profiles: own record or same org (admin+)
CREATE POLICY "profiles_self" ON profiles
  FOR ALL USING (
    id = auth.uid()
    OR (
      organization_id IN (
        SELECT organization_id FROM profiles
        WHERE id = auth.uid() AND role IN ('owner','admin')
      )
    )
  );

-- Patients: same organization
CREATE POLICY "patients_org" ON patients
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Appointments: via clinic → organization
CREATE POLICY "appointments_org" ON appointments
  FOR ALL USING (
    clinic_id IN (
      SELECT c.id FROM clinics c
      JOIN profiles p ON p.organization_id = c.organization_id
      WHERE p.id = auth.uid()
    )
  );

-- Conversations: via clinic
CREATE POLICY "conversations_org" ON conversations
  FOR ALL USING (
    clinic_id IN (
      SELECT c.id FROM clinics c
      JOIN profiles p ON p.organization_id = c.organization_id
      WHERE p.id = auth.uid()
    )
  );

-- Messages: via conversation → clinic
CREATE POLICY "messages_org" ON messages
  FOR ALL USING (
    conversation_id IN (
      SELECT cv.id FROM conversations cv
      JOIN clinics c ON c.id = cv.clinic_id
      JOIN profiles p ON p.organization_id = c.organization_id
      WHERE p.id = auth.uid()
    )
  );

-- NPS: via clinic
CREATE POLICY "nps_org" ON nps_responses
  FOR ALL USING (
    clinic_id IN (
      SELECT c.id FROM clinics c
      JOIN profiles p ON p.organization_id = c.organization_id
      WHERE p.id = auth.uid()
    )
  );

-- Patient scores: via clinic
CREATE POLICY "scores_org" ON patient_scores
  FOR ALL USING (
    clinic_id IN (
      SELECT c.id FROM clinics c
      JOIN profiles p ON p.organization_id = c.organization_id
      WHERE p.id = auth.uid()
    )
  );

-- Analytics: via clinic
CREATE POLICY "analytics_org" ON analytics_daily
  FOR ALL USING (
    clinic_id IN (
      SELECT c.id FROM clinics c
      JOIN profiles p ON p.organization_id = c.organization_id
      WHERE p.id = auth.uid()
    )
  );

-- Professionals: via organization
CREATE POLICY "professionals_org" ON professionals
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orgs_updated      BEFORE UPDATE ON organizations      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_clinics_updated   BEFORE UPDATE ON clinics             FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_profiles_updated  BEFORE UPDATE ON profiles            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_professionals_upd BEFORE UPDATE ON professionals       FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_patients_updated  BEFORE UPDATE ON patients            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_appointments_upd  BEFORE UPDATE ON appointments        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_conversations_upd BEFORE UPDATE ON conversations       FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile when user registers
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, organization_id, full_name)
  SELECT
    NEW.id,
    (NEW.raw_user_meta_data->>'organization_id')::UUID,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  WHERE NEW.raw_user_meta_data->>'organization_id' IS NOT NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
