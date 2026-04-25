INSERT INTO variants (id, executor, name)
VALUES ('seed-variant', 'claude-code', 'seed')
ON CONFLICT DO NOTHING;
