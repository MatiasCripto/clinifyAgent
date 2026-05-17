-- Migration 009: Allow superadmin profiles to have NULL organization_id
-- Superadmins are platform-level, not tied to any organization
ALTER TABLE profiles ALTER COLUMN organization_id DROP NOT NULL;
