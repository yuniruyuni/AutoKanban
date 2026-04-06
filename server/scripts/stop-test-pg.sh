#!/bin/sh
# Stop the test PostgreSQL instance after test runs.
# bun test does not fire process "exit" events, so this must be called externally.
PIDFILE="$(dirname "$0")/../.test-pg-data/postmaster.pid"
if [ -f "$PIDFILE" ]; then
  PID=$(head -1 "$PIDFILE")
  kill "$PID" 2>/dev/null
fi
