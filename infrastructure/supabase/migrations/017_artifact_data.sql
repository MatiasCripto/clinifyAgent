-- Add artifact_data JSONB to clinical_records for interactive clinical artifacts
ALTER TABLE clinical_records ADD COLUMN IF NOT EXISTS artifact_data jsonb;
