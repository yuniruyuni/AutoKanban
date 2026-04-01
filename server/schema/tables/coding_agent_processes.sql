-- coding_agent_processes
CREATE TABLE IF NOT EXISTS coding_agent_processes (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  status TEXT NOT NULL DEFAULT 'running',
  exit_code INTEGER,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coding_agent_processes_session_id ON coding_agent_processes(session_id);
CREATE INDEX IF NOT EXISTS idx_coding_agent_processes_status ON coding_agent_processes(status);
