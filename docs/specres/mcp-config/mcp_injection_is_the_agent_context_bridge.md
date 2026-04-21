---
id: "01KPNX4PAKZFYMM4A6PYTRH0S0"
name: "mcp_injection_is_the_agent_context_bridge"
status: "draft"
---

## 関連ファイル

- `server/src/presentation/mcp/stdio.ts`
- `server/src/presentation/mcp/routers/tools.ts`
- `server/src/models/agent-config-defaults/`
- `server/src/repositories/agent-config/`
- `server/src/infra/port-file/`

## 機能概要

**MCP Injection は、AutoKanban 自身を MCP (Model Context Protocol) サーバーとして
外部 Coding Agent に自動登録する仕組み**である。
Agent 起動の直前に AutoKanban が自分の port を port-file で通知しつつ、
Executor の MCP 設定ファイルに `auto_kanban` エントリを差し込む。
これにより Agent は `find_workspace_by_path` / `list_sibling_tasks` などのツールを
呼び出せるようになる。

## 設計意図

### なぜ Agent に文脈を与える必要があるか

AI コーディングエージェントの弱点は「**自分の置かれている文脈を知らない**」こと:

- 自分がいるディレクトリが AutoKanban のどのタスクに対応するか
- そのタスクの詳細な説明は何か
- 過去 attempt で何を試してどう失敗したか
- 同じプロジェクトの別タスクで関連する判断がされているか

これらは AutoKanban の DB に全部あるが、通常は AI からは見えない。
このギャップを埋めないと、AI は毎回「白紙から推測」する必要があり、
回答品質が大きく下がる。

### なぜ MCP を選んだか

他の選択肢と比較:

- **prompt に全部埋め込む** — token を食いすぎる、情報が動的でない
- **特殊 API を Agent 側に実装させる** — Agent ごとに統合コードが必要、汎用性がない
- **MCP 経由で Agent が必要時に取りに来る** — 標準プロトコル、token 消費は必要なとき最小限

MCP は Anthropic が提唱した、AI と外部ツール / データソースを繋ぐ標準プロトコル。
Claude Code はじめ主要な Coding Agent がサポート済みで、AutoKanban が
MCP サーバーを露出するだけで複数 Agent が同じツール群を使える。

### なぜ自動注入にしたか

ユーザーに「Claude Code の `mcpServers.json` に手動で追記してください」と頼む方式は動くが:

- port が動的割当（embedded-postgres と同居するため毎回変わりうる）なので設定が stale になる
- 初回セットアップの摩擦が大きい（ユーザーが JSON を壊すリスク）
- 複数 executor（Claude Code / Gemini）で同じことを繰り返す必要がある

**AutoKanban 側が Agent 起動の直前に設定ファイルを書き換える**ことで、
ユーザー操作ゼロで MCP 接続が成立する。port は port-file（`~/.autokanban/port`）で通知し、
Agent 起動時の最新 port を必ず反映する。

### 公開ツールの設計思想

`server/src/presentation/mcp/routers/tools.ts` が公開するツールは「Agent が自分の文脈を
取りに来るための薄いクエリ API」に絞る。原則:

- **read-only**: MCP ツールから DB を書き換えない（AutoKanban の UI 経由でしか書かない）
- **文脈的**: 現在の worktree / taskId から辿れる情報に限定
- **横断しすぎない**: 全プロジェクト横断の重い検索は提供しない

代表例:

- `find_workspace_by_path(path)` — worktree パスから Task / Project へ逆引き
- `get_task_context(taskId)` — タスク説明と関連情報
- `list_sibling_tasks(projectId)` — 同プロジェクトの他タスク列挙

### stdio と HTTP の両対応

Claude Code は stdio MCP、Gemini は HTTP MCP、のように executor ごとに接続方式が違う。
`presentation/mcp/stdio.ts` と HTTP ルートを両方用意することで同じ tool 実装をどちらからも
使えるようにしている。

## 主要メンバー

- MCP ツール群（`tools.ts` で定義）
- Port file フォーマット: `{ pid, port }` を `~/.autokanban/port` に書き込み
- Agent 設定 injection: `agent-config` Repository が executor 別のファイル書き換えを担当
- Auto-Kanban 側 MCP サーバーの自己 URL: `http://localhost:<port>/mcp` or stdio

## 関連する動作

- 設定: [mcp_servers_are_configured_per_agent](./mcp_servers_are_configured_per_agent.md)
- 注入: [auto_kanban_is_injected_as_mcp_server](./auto_kanban_is_injected_as_mcp_server.md)
