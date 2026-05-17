-- 008: Service areas within specialties
-- Each professional defines areas under their specialty (e.g. "Masajes", "Descontracturas")
-- Each area has a fixed duration. Professionals assign areas to time slots in their agenda.

CREATE TABLE service_areas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,                       -- e.g. "Masajes", "Descontracturas"
  duration_min    INT NOT NULL DEFAULT 30,             -- session duration in minutes
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (professional_id, name)
);

CREATE TRIGGER trg_service_areas_updated
  BEFORE UPDATE ON service_areas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Add area_id to weekly_schedules slots so each slot can reference an area
-- The schedule JSONB currently stores: { "1": { is_working, start_time, end_time, slots, slot_duration } }
-- We'll add an optional "areas" array to each day: { "1": { ..., "areas": ["area_id_1", "area_id_2", ...] } }
-- This is handled in application code, no schema change needed for the JSONB column.

ALTER TABLE service_areas ENABLE ROW LEVEL SECURITY;
