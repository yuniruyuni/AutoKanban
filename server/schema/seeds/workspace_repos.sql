INSERT INTO workspace_repos (id, workspace_id, project_id, target_branch)
VALUES ('seed-workspace-repo', 'seed-workspace', 'seed-project', 'main')
ON CONFLICT DO NOTHING;
