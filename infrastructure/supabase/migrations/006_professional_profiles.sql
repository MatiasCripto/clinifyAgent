-- ============================================================
-- OdontoCare SaaS · Migration 006 · Professional-Profile Link
-- Links professionals to auth users so staff can log in
-- ============================================================

-- Add profile_id to professionals (nullable — only for staff logins)
ALTER TABLE professionals
  ADD COLUMN profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX idx_professionals_profile ON professionals (profile_id);
