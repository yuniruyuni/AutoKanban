INSERT INTO coding_agent_process_logs (coding_agent_process_id)
VALUES ('seed-coding-agent-process')
ON CONFLICT DO NOTHING;
