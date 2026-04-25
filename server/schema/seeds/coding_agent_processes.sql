INSERT INTO coding_agent_processes (id, session_id)
VALUES ('seed-coding-agent-process', 'seed-session')
ON CONFLICT DO NOTHING;
