-- variants (configuration variants for executors)
CREATE TABLE IF NOT EXISTS variants (
  id TEXT PRIMARY KEY,
  executor TEXT NOT NULL,
  name TEXT NOT NULL,
  permission_mode TEXT NOT NULL DEFAULT 'bypassPermissions',
  model TEXT,
  append_prompt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(executor, name)
);
