INSERT INTO projects (id, name, repo_path)
VALUES ('seed-project', 'seed-project', '/tmp/seed-repo')
ON CONFLICT DO NOTHING;
