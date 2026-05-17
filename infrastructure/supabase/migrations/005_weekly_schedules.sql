-- ============================================================
-- OdontoCare SaaS · Migration 005 · Weekly Schedules
-- Professional weekly agenda configuration
-- ============================================================

CREATE TABLE weekly_schedules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  clinic_id       UUID REFERENCES clinics(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,         -- Monday of the week
  schedule        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (professional_id, clinic_id, week_start_date)
);

CREATE TRIGGER trg_weekly_schedules_updated
  BEFORE UPDATE ON weekly_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE weekly_schedules ENABLE ROW LEVEL SECURITY;
