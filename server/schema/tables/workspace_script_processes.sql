-- workspace_script_processes (script_type: 'prepare' or 'cleanup')
CREATE TABLE IF NOT EXISTS workspace_script_processes (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  script_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  exit_code INTEGER,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_script_processes_session_id ON workspace_script_processes(session_id);
CREATE INDEX IF NOT EXISTS idx_workspace_script_processes_status ON workspace_script_processes(status);
