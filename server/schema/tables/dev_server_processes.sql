-- dev_server_processes
-- proxy_port is AutoKanban's own port reserved per-process to pass-through
-- proxy the preview to the viewer's browser. The detected dev server target
-- URL (from stdout logs) is reached via this proxy, so the browser never
-- needs to talk to the project's dev server port directly — the convention
-- is "URL must be reachable from AutoKanban", not "URL must be reachable
-- from the browser".
CREATE TABLE IF NOT EXISTS dev_server_processes (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  status TEXT NOT NULL DEFAULT 'running',
  exit_code INTEGER,
  proxy_port INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dev_server_processes_session_id ON dev_server_processes(session_id);
CREATE INDEX IF NOT EXISTS idx_dev_server_processes_status ON dev_server_processes(status);
