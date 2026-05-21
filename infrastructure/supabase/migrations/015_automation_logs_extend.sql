-- Extend automation_logs for job system (non-n8n)
ALTER TABLE automation_logs
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- Add dedup index: one success log per entity per job type
CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_logs_dedup
  ON automation_logs (entity_id, workflow)
  WHERE status = 'success' AND entity_id IS NOT NULL;

-- Index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_automation_logs_workflow_time
  ON automation_logs (workflow, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_logs_org
  ON automation_logs (organization_id);
