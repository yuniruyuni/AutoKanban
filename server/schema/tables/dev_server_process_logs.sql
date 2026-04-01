-- dev_server_process_logs
CREATE TABLE IF NOT EXISTS dev_server_process_logs (
  dev_server_process_id TEXT PRIMARY KEY REFERENCES dev_server_processes(id),
  logs TEXT NOT NULL DEFAULT ''
);
