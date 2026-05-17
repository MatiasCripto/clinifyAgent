-- 007: Associate WhatsApp Evolution instance with a specific clinic
-- Each bot works with ONE clinic only.

ALTER TABLE clinics ADD COLUMN IF NOT EXISTS evolution_instance TEXT;

COMMENT ON COLUMN clinics.evolution_instance IS 'Evolution API instance name linked to this clinic (one bot per clinic)';
