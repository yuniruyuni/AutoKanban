#!/bin/sh
# worktreeごとにランダムポートで開発サーバを起動するスクリプト
# auto-kanban.json の server フィールドから呼び出される
#
# AutoKanban を preview する場合 (AutoKanban 自身を dogfood する場合)、
# 親 AutoKanban と state を完全に分離しないと子の起動時 recovery が親の
# DB 上の dev_server_processes を "killed" に書き換えてしまう。親は spawn 時に
# AK_PROCESS_ID 等を env で渡してくるので、それを使って isolation 用の
# AUTO_KANBAN_HOME (DB / ports / pgschema バイナリ / worktree プールの置き場)
# をプロセスごと別にする。
if [ -n "$AK_PROCESS_ID" ]; then
  # workspace を含めることで cleanup が glob (workspace 単位) しやすくなる
  export AUTO_KANBAN_HOME="/tmp/auto-kanban-preview-${AK_WORKSPACE_ID}-${AK_PROCESS_ID}"
fi

BASE_PORT=$(shuf -i 10000-59000 -n 1)

export PORT=$BASE_PORT
export VITE_PORT=$((BASE_PORT + 1))
export VITE_PROXY_TARGET="http://localhost:$BASE_PORT"
export VITE_API_URL="http://localhost:$BASE_PORT"

exec bun run --filter '*' --parallel start:dev
