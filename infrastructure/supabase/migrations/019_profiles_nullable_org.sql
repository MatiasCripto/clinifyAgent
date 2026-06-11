-- ============================================================
-- OdontoCare SaaS · Migration 019
-- Allow null organization_id in profiles for onboarding flow
-- ============================================================

-- Make organization_id nullable so new users can register without an org
ALTER TABLE profiles ALTER COLUMN organization_id DROP NOT NULL;

-- Update trigger to always create a profile on signup (without requiring org_id)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, organization_id, full_name, role)
  VALUES (
    NEW.id,
    (NEW.raw_user_meta_data->>'organization_id')::UUID,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'owner'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
