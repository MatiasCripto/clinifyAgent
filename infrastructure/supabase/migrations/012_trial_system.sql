-- Add trial tracking to organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at    timestamptz;

-- Set trial for existing Pro orgs that don't have one yet
UPDATE organizations
  SET trial_started_at = NOW(),
      trial_ends_at = NOW() + INTERVAL '14 days'
  WHERE plan = 'pro'
    AND trial_ends_at IS NULL;
