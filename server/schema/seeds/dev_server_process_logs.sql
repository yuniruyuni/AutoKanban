INSERT INTO dev_server_process_logs (dev_server_process_id)
VALUES ('seed-dev-server-process')
ON CONFLICT DO NOTHING;
