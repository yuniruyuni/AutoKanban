INSERT INTO workspaces (id, task_id, container_ref)
VALUES ('seed-workspace', 'seed-task', 'seed-container')
ON CONFLICT DO NOTHING;
