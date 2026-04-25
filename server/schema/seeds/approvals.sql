INSERT INTO approvals (id, execution_process_id, tool_name, tool_call_id)
VALUES ('seed-approval', 'seed-coding-agent-process', 'seed-tool', 'seed-tool-call')
ON CONFLICT DO NOTHING;
