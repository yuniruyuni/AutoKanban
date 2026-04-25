INSERT INTO tools (id, name, icon, command)
VALUES ('seed-tool', 'seed', 'wrench', 'echo seed')
ON CONFLICT DO NOTHING;
