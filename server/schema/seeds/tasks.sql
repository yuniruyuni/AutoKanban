INSERT INTO tasks (id, project_id, title)
VALUES ('seed-task', 'seed-project', 'seed task')
ON CONFLICT DO NOTHING;
