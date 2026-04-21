---
id: "01KPNTBSG5R2DQ15S2NJ893VNE"
name: "auto_kanban_is_injected_as_mcp_server"
status: "draft"
---

## 関連ファイル

- `server/src/presentation/mcp/stdio.ts`
- `server/src/presentation/mcp/routers/tools.ts`
- `server/src/models/agent-config-defaults/`
- `server/src/infra/port-file/`
- `server/src/repositories/agent-config/`

## 機能概要

AutoKanban は**自分自身を MCP サーバーとして**外部の Coding Agent（Claude Code 等）に
自動登録する。これにより agent は「今いる workspace を知る」「カンバン上の他タスクを参照する」
「親タスクの詳細を取る」などの AutoKanban 固有ツールを MCP 経由で呼び出せる。

port 情報は `infra/port-file/` が書く一時ファイル（`~/.autokanban/port`）を介して渡される。
agent が起動するたび、AutoKanban は現在のポートで MCP サーバーを刺し、
agent の設定ファイルに `auto_kanban` エントリを差し込む（既にあれば上書き）。

## 概念的背景: なぜ AutoKanban 自身が MCP サーバーになるのか

AI コーディングエージェントの弱点の一つは、**自分の置かれている文脈を知らない**ことである。
具体的には:

- 自分がいるディレクトリがどのプロジェクトのどのタスクに対応するか
- そのタスクにはどんな説明・やりたいことが書かれているか
- 同じプロジェクトの別タスクで過去にどんな試行があったか、その失敗パターンは何だったか
- 自分の前の attempt で何を試してダメだったか

これらは AutoKanban の DB に全部あるが、通常は **AI からは見えない**。
このギャップを埋めるのが MCP (Model Context Protocol) 統合で、
AutoKanban を **MCP サーバー**として公開することで、AI が必要な時に自分で
「今の文脈」を取りに来れるようにする。

典型的に露出するツール群（`server/src/presentation/mcp/routers/tools.ts`）:

- `find_workspace_by_path(path)` — worktree パスから Task / Project の情報を取る
- `get_task_context(taskId)` — タスクの説明と関連情報を取る
- `list_sibling_tasks(projectId)` — 同じプロジェクトの他タスクを列挙

もう 1 つの重要な設計判断は **AutoKanban 側から自動注入する** こと。
ユーザーに「Claude Code の `mcpServers.json` に以下を追記してください」と頼む方式は
動くが摩擦が大きく、また port が動的に変わるたびに設定を更新しなければならない。
AutoKanban が agent を spawn する直前に agent の設定ファイルに `auto_kanban` エントリを
書き込むことで、**ユーザー操作ゼロで MCP 接続を成立させる**。

## 設計意図

- **port 自動検出**: embedded-postgres と同様、ポートは動的割当なので port-file で通知。
  `~/.autokanban/port` に PID と現在の port を書き、agent 起動側（AutoKanban）と
  MCP 接続時（agent 自身）の両方から参照できるようにする
- **agent 設定ファイルへの注入**: ユーザーが手動で JSON を書く必要がない（摩擦を減らす）。
  実装は `agent-config` Repository が executor ごとの設定フォーマット差異を吸収
- **双方向接続**: agent → AutoKanban（MCP tools で context 取得）、
  AutoKanban → agent（executor プロセス起動、stdout/stderr 監視、control protocol）。
  これにより AutoKanban は単なる起動元ではなく、**agent の文脈源泉**としても振る舞う
- **stdio と HTTP の両対応**: Claude Code は stdio MCP、Gemini は HTTP MCP、のように
  executor によって接続方式が違う。`presentation/mcp/stdio.ts` と HTTP ルートを両方用意することで
  同じ tool 実装をどちらからも使えるようにしている

## シナリオ

### Inject on agent start

1. `startExecution` の post で executor プロセスを起動する前に
   `agentConfig` Repository が `auto_kanban` の MCP 設定を書き込む
2. MCP サーバー URL は `http://localhost:<port>/mcp` のような形
3. agent プロセスが起動して MCP handshake を行うと tools が露出する

### Handle stdio transport

1. `/mcp/stdio` エンドポイントで stdio トランスポートも受け付ける
2. Claude Code の stdio モードからも接続できる

### MCP tool listing

1. `presentation/mcp/routers/tools.ts` が `find_workspace_by_path`, `get_task_context`,
   `list_sibling_tasks` などのツールを提供
2. agent がこれらを呼んで自分の context を把握できる

## 失敗 / 例外

- port-file の書き込み失敗 → AutoKanban は起動を拒否する
- agent 側が MCP 設定を無視する場合は機能しないが fail ではない
