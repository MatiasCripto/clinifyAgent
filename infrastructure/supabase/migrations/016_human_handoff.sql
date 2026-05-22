-- Human handoff: pause agent, enable manual takeover
ALTER TABLE wa_conversations
  ADD COLUMN IF NOT EXISTS human_takeover boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS human_takeover_at timestamptz,
  ADD COLUMN IF NOT EXISTS human_takeover_reason text,
  ADD COLUMN IF NOT EXISTS human_released_at timestamptz;
