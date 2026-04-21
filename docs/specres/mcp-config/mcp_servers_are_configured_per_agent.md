---
id: "01KPNTBSG4HEKJYAW9Q9SM25R8"
name: "mcp_servers_are_configured_per_agent"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/presentation/trpc/routers/mcp-config.ts`
- `server/src/repositories/agent-config/`
- `server/src/models/agent-config-defaults/`
- `client/src/pages/settings/MCPServerPage.tsx`

## 機能概要

Executor ごとの MCP サーバー設定を編集する画面と API。
Claude Code の `mcpServers.json` / Gemini の対応ファイルなど、
**各 executor の設定ファイル**を AutoKanban 経由で読み書きする。
`auto_kanban` 自体をサーバーリストに自動注入する仕組みは別カードで扱う。

## 設計意図

Executor 毎に設定フォーマットが微妙に違うため、`agent-config` Repository が差異を吸収する。
設定は `auto-kanban.json` や Claude Code の設定ディレクトリ（OS 別）にファイルとして保存される。

## シナリオ

### View & edit MCP server list

1. `/settings/mcp-server` で `trpc.mcpConfig.list({ executor })`
2. JSON エディタで編集、`trpc.mcpConfig.update({ executor, config })` で保存

### Apply to new agent runs

1. 保存された設定は次回 agent 起動時に自動で使われる
2. 変更後に再起動は不要（executor が起動時に最新設定を読む）

## 失敗 / 例外

- JSON parse エラーは UI 側で表示
- ファイルのパーミッションエラーは Repository 層から標準化された error として返る
