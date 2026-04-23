#!/bin/sh
# Stop the test PostgreSQL instance after server test runs and destroy the
# data directory so the next run starts from a blank state.
#
# Why destroy the data dir?
#   Fast shutdown (SIGINT) is supposed to leave pg_control in a "shut down"
#   state, but under load (or when the shutdown races our 10s wait and
#   escalates to SIGKILL) pg_control can be left in a transient
#   "shutting down" state. The next PG startup treats that as an interrupted
#   shutdown and enters crash recovery, which can take long enough to
#   trigger bun test's 5s per-test timeout — every test then cascades with
#   "Failed to start PostgreSQL". Blasting the data dir costs ~0.5s for a
#   fresh initdb on next start but eliminates the entire recovery path.
#
# Shutdown strategy (for the PG instance itself, before rm -rf):
#   1. Capture postmaster's backend children so we wait for the whole family
#      to detach from shared memory.
#   2. SIGINT postmaster for fast shutdown; wait up to 10s.
#   3. SIGKILL any stragglers.
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
