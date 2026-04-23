#!/bin/sh
# Run bun test with guaranteed PG cleanup even on SIGINT/SIGTERM.
# Without the EXIT trap, npm-run-all --parallel sending SIGINT to the shell
# (when a sibling check fails) killed `bun test` without running the
# trailing stop-test-pg.sh, leaving the test PostgreSQL instance orphaned
# and the next `bun run check` reusing a half-dead PG.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cleanup() {
	"$SCRIPT_DIR/stop-test-pg.sh"
}
trap cleanup EXIT
cd "$SCRIPT_DIR/.." && bun test "$@"
