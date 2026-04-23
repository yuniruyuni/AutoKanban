#!/bin/sh
# Run bun test with guaranteed PG cleanup even on SIGINT/SIGTERM.
# See server/scripts/run-test.sh for rationale.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cleanup() {
	"$SCRIPT_DIR/stop-test-pg.sh"
}
trap cleanup EXIT
cd "$SCRIPT_DIR/.." && bun test "$@"
