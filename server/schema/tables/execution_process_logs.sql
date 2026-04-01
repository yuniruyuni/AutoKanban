-- execution_process_logs
CREATE TABLE IF NOT EXISTS execution_process_logs (
  execution_process_id TEXT PRIMARY KEY REFERENCES execution_processes(id),
  logs TEXT NOT NULL DEFAULT ''
);
