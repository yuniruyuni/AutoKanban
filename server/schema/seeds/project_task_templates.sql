INSERT INTO project_task_templates (id, title)
VALUES ('seed-project-task-template', 'seed template')
ON CONFLICT DO NOTHING;
