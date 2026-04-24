---
id: "01KPNTBSG4HEKJYAW9Q9SM25R8"
name: "mcp_servers_are_configured_per_agent"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/presentation/trpc/routers/mcp-config.ts`
- `server/src/repositories/agent-config/`
- `server/src/models/agent/`
- `server/src/models/agent-config-defaults/`
- `client/src/pages/settings/MCPServerPage.tsx`

## 機能概要

Agent ごとの MCP サーバー設定を編集する画面と API。
Claude Code の `~/.claude.json`、Codex CLI の `~/.codex/config.toml` など、
**各 Agent の設定ファイル**を AutoKanban 経由で読み書きする。
`auto_kanban` 自体をサーバーリストに自動注入する仕組みは別カードで扱う。

## 設計意図

Agent 毎に設定フォーマットが違うため、`agent-config` Repository が差異を吸収する。
Claude Code は JSON、Codex CLI は TOML であり、同じ MCP server list でも保存形式が異なる。
usecase / UI は「agent id と servers map」を扱い、ファイル形式の差は repository に閉じる。

この repository は model と infra の接点である。
Agent の種類は [Agent](../agent/agent_is_the_coding_agent_definition.md) で定義されるが、
実際にどの config file を読み書きするかは `AgentConfigRepository` の adapter が決める。

## 設定形式

### Claude Code

Claude Code は `~/.claude.json` の `mcpServers` を読み書きする。

```json
{
  "mcpServers": {
    "auto_kanban": {
      "command": "auto-kanban",
      "args": ["--mcp"]
    }
  }
}
```

### Codex CLI

Codex CLI は `~/.codex/config.toml` の `mcp_servers.<name>` section を読み書きする。

```toml
[mcp_servers.auto_kanban]
command = "auto-kanban"
args = ["--mcp"]
```

AutoKanban の TOML 書き込みは MCP server section の管理に必要な最小 subset を扱う。
既存の他設定は保持し、`[mcp_servers.*]` section だけを再生成する。

## シナリオ

### MCP サーバー一覧の閲覧と編集

1. `/settings/mcp-server` で `trpc.mcpConfig.listAgents` から対応 Agent を列挙
2. `trpc.mcpConfig.getAgentConfig({ agentId })` で対象 Agent の MCP server map を読む
3. JSON エディタで編集、`trpc.mcpConfig.updateAgentConfig({ agentId, servers })` で保存
4. Repository が Agent ごとの config format に変換して書き込む

### 新規 agent 実行への適用

1. 保存された設定は次回 agent 起動時に自動で使われる
2. 変更後に AutoKanban の再起動は不要（agent が起動時に最新設定を読む）

### `auto_kanban` の注入

1. `trpc.mcpConfig.injectSelf({ agentId })` が呼ばれる
2. `getPreconfiguredServers().auto_kanban` から現在の AutoKanban MCP 起動設定を作る
3. Repository が対象 Agent の config file へ `auto_kanban` server を上書き保存する
4. 次回 agent 起動時に AutoKanban MCP tools が使える

## 失敗 / 例外

- Claude JSON parse エラーは空 servers として扱う
- Codex TOML の未対応構文は MCP server section の読み取り対象外になる
- ファイルのパーミッションエラーは Repository 層から標準化された error として返る
- 対象 `agentId` が未対応なら `{ servers: {}, configPath: null }` を返す
