-- workspace_script_process_logs
CREATE TABLE IF NOT EXISTS workspace_script_process_logs (
  workspace_script_process_id TEXT PRIMARY KEY REFERENCES workspace_script_processes(id),
  logs TEXT NOT NULL DEFAULT ''
);
