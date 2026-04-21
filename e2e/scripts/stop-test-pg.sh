#!/bin/sh
# Stop the test PostgreSQL instance after e2e test runs.
# bun test does not fire process "exit" events, so this must be called externally.
# Resolves to e2e/.test-pg-data regardless of caller CWD.
#
# Uses SIGINT (PostgreSQL "fast shutdown") which aborts active transactions
# but writes a checkpoint before exiting. This leaves WAL in a consistent
# state, so the next startup does not need crash recovery (unlike SIGQUIT).
# Waits up to 10s for the process to exit before returning.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PIDFILE="$SCRIPT_DIR/../.test-pg-data/postmaster.pid"
if [ -f "$PIDFILE" ]; then
  PID=$(head -1 "$PIDFILE")
  if [ -n "$PID" ]; then
    kill -INT "$PID" 2>/dev/null
    i=0
    while [ "$i" -lt 20 ]; do
      kill -0 "$PID" 2>/dev/null || break
      sleep 0.5
      i=$((i + 1))
    done
  fi
fi
