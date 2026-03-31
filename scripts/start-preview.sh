#!/bin/sh
# worktreeごとにランダムポートで開発サーバを起動するスクリプト
# auto-kanban.json の server フィールドから呼び出される

BASE_PORT=$(shuf -i 10000-59000 -n 1)

export PORT=$BASE_PORT
export VITE_PORT=$((BASE_PORT + 1))
export VITE_PROXY_TARGET="http://localhost:$BASE_PORT"
export VITE_API_URL="http://localhost:$BASE_PORT"

exec bun run --filter '*' --parallel start:dev
