#!/bin/sh
# Wrap `specre` to filter the benign README.md parse warning.
#
# specre 0.5.x scans every .md under `specre_dir` as a card, and README.md (the
# human entry point) has no frontmatter by design. There is no CLI or config
# option to exclude it, and renaming it would cascade into CLAUDE.md, root
# README, .claude/commands/*, and .githooks/pre-commit. Dropping only this
# single known-safe warning keeps other stderr (real errors / drift messages)
# visible.

set -u
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

specre "$@" 2>"$tmp"
rc=$?

grep -v "missing opening '---' delimiter" "$tmp" >&2 || true

exit $rc
