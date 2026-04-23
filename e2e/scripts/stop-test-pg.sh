#!/bin/sh
# Stop the test PostgreSQL instance after e2e test runs and destroy the
# data directory so the next run starts from a blank state.
# See server/scripts/stop-test-pg.sh for the full rationale.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="$SCRIPT_DIR/../.test-pg-data"
PIDFILE="$DATA_DIR/postmaster.pid"

kill_pg_family() {
	[ -f "$PIDFILE" ] || return 0
	PID=$(head -1 "$PIDFILE")
	[ -n "$PID" ] || return 0
	kill -0 "$PID" 2>/dev/null || return 0

	CHILDREN=$(pgrep -P "$PID" 2>/dev/null)
	ALL_PIDS="$PID $CHILDREN"

	any_alive() {
		for p in $ALL_PIDS; do
			kill -0 "$p" 2>/dev/null && return 0
		done
		return 1
	}

	kill -INT "$PID" 2>/dev/null
	i=0
	while [ "$i" -lt 50 ]; do
		any_alive || return 0
		sleep 0.2
		i=$((i + 1))
	done

	for p in $ALL_PIDS; do
		kill -KILL "$p" 2>/dev/null
	done
	i=0
	while [ "$i" -lt 25 ]; do
		any_alive || return 0
		sleep 0.2
		i=$((i + 1))
	done
}

kill_pg_family
rm -rf "$DATA_DIR"
