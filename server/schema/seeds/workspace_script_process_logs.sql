INSERT INTO workspace_script_process_logs (workspace_script_process_id)
VALUES ('seed-workspace-script-process')
ON CONFLICT DO NOTHING;
