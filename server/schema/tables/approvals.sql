-- approvals (permission/plan approval requests, DB-persisted)
CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  execution_process_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  tool_call_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approvals_execution_process_id ON approvals(execution_process_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
