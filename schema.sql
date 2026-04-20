-- AEO Visibility MCP — Neon DB schema
-- Run this once in your Neon console (or via psql) to set up the tables.
-- This adds new tables to your existing DB without touching anything else.

-- API keys table (keys are hashed with SHA-256 before storage)
CREATE TABLE IF NOT EXISTS aeo_api_keys (
  id          SERIAL PRIMARY KEY,
  key_hash    TEXT        NOT NULL UNIQUE,   -- SHA-256 of the actual key
  label       TEXT,                          -- human label, e.g. "Vipul personal"
  user_email  TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  usage_count INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- Usage log (one row per API call)
CREATE TABLE IF NOT EXISTS aeo_usage_logs (
  id         BIGSERIAL   PRIMARY KEY,
  key_hash   TEXT        NOT NULL REFERENCES aeo_api_keys(key_hash) ON DELETE CASCADE,
  path       TEXT        NOT NULL,           -- e.g. /mcp or /api/analyze
  called_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aeo_usage_logs_key_hash ON aeo_usage_logs(key_hash);
CREATE INDEX IF NOT EXISTS idx_aeo_usage_logs_called_at ON aeo_usage_logs(called_at);

-- -----------------------------------------------------------------------
-- How to insert an API key:
--
-- 1. Generate a key string in your app or terminal, e.g.:
--    node -e "console.log('aeo_' + require('crypto').randomBytes(24).toString('hex'))"
--
-- 2. Hash it with SHA-256:
--    node -e "const c=require('crypto'); const k='aeo_YOUR_KEY_HERE'; console.log(c.createHash('sha256').update(k).digest('hex'))"
--
-- 3. Insert the hash (never store the raw key):
--    INSERT INTO aeo_api_keys (key_hash, label, user_email)
--    VALUES ('<hash>', 'My key', 'user@example.com');
-- -----------------------------------------------------------------------
