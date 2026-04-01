-- coding_agent_process_logs
CREATE TABLE IF NOT EXISTS coding_agent_process_logs (
  coding_agent_process_id TEXT PRIMARY KEY REFERENCES coding_agent_processes(id),
  logs TEXT NOT NULL DEFAULT ''
);
