-- tools
CREATE TABLE IF NOT EXISTS tools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  icon_color TEXT NOT NULL DEFAULT '#6B7280',
  command TEXT NOT NULL,
  -- argv: array form (preferred). When non-NULL, executed via spawn() without
  -- a shell, so {path} is substituted as a literal arg (no metacharacter
  -- expansion). When NULL, the legacy `command` field is used via `sh -c`
  -- with shell-escaped path substitution. See execute-tool.ts.
  argv JSONB,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
