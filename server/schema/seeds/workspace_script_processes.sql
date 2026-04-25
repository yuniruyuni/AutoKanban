INSERT INTO workspace_script_processes (id, session_id, script_type)
VALUES ('seed-workspace-script-process', 'seed-session', 'prepare')
ON CONFLICT DO NOTHING;
