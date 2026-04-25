INSERT INTO agent_settings (agent_id, command)
VALUES ('seed-agent', 'echo seed')
ON CONFLICT DO NOTHING;
