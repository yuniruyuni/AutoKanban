-- proxy_port is included because the origin/main baseline schema declares
-- it NOT NULL without a DEFAULT. After this fix lands on main, future
-- baselines will accept omission, but providing 0 stays harmless.
INSERT INTO dev_server_processes (id, session_id, proxy_port)
VALUES ('seed-dev-server-process', 'seed-session', 0)
ON CONFLICT DO NOTHING;
