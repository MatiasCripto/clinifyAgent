-- ============================================================
-- OdontoCare SaaS · Migration 004
-- WhatsApp bot conversations & messages (with context persistence)
-- ============================================================

CREATE TABLE wa_conversations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone       TEXT NOT NULL UNIQUE,
  name        TEXT,
  bot_state   TEXT NOT NULL DEFAULT 'idle',
  context     JSONB NOT NULL DEFAULT '{}',  -- full BotContext stored here
  last_msg_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wa_conversations_phone ON wa_conversations (phone);

CREATE TABLE wa_messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES wa_conversations(id) ON DELETE CASCADE,
  direction       TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wa_messages_conv ON wa_messages (conversation_id, created_at DESC);
