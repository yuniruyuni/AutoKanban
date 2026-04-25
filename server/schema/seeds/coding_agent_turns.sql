INSERT INTO coding_agent_turns (id, execution_process_id)
VALUES ('seed-coding-agent-turn', 'seed-coding-agent-process')
ON CONFLICT DO NOTHING;
