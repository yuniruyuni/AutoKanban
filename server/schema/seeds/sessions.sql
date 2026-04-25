INSERT INTO sessions (id, workspace_id)
VALUES ('seed-session', 'seed-workspace')
ON CONFLICT DO NOTHING;
