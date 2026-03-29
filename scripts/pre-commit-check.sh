#!/usr/bin/env bash
# Pre-commit check: runs lint, typecheck, tests, arch check
# Returns JSON for Claude Code PreToolUse hook
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

errors=""

# 1. Lint
if ! lint_output=$(bun run check:lint 2>&1); then
  errors="${errors}\n=== LINT FAILED ===\n${lint_output}\n"
fi

# 2. Typecheck
if ! typecheck_output=$(bun run check:type 2>&1); then
  errors="${errors}\n=== TYPECHECK FAILED ===\n${typecheck_output}\n"
fi

# 3. Tests
if ! test_output=$(bun run check:test 2>&1); then
  errors="${errors}\n=== TESTS FAILED ===\n${test_output}\n"
fi

# 4. Architecture check
if ! arch_output=$(bun run check:arch 2>&1); then
  errors="${errors}\n=== ARCH CHECK FAILED ===\n${arch_output}\n"
fi

if [ -n "$errors" ]; then
  # Escape for JSON: replace newlines, quotes, backslashes
  escaped=$(printf '%s' "$errors" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')
  echo "{\"decision\":\"block\",\"reason\":${escaped}}"
  exit 0
fi

# All checks passed — allow commit
echo '{"continue":true}'
