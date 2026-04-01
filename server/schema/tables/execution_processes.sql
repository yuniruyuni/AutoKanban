-- execution_processes
CREATE TABLE IF NOT EXISTS execution_processes (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  run_reason TEXT NOT NULL DEFAULT 'setupscript',
  status TEXT NOT NULL DEFAULT 'running',
  exit_code INTEGER,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_execution_processes_session_id ON execution_processes(session_id);
CREATE INDEX IF NOT EXISTS idx_execution_processes_status ON execution_processes(status);
