# MCPサーバー

## 概要

Auto Kanbanは [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) サーバーを内蔵しており、Claude Code等のAIエージェントからタスク管理操作を直接実行できる。

MCPサーバーはHTTPサーバーと同じプロセスから起動されるが、通信方式が異なる:
- **HTTPサーバー** (デフォルト): ブラウザUI向け、tRPC over HTTP
- **MCPサーバー** (`--mcp`フラグ): AIエージェント向け、JSON-RPC over stdio

## アーキテクチャ

```
┌──────────────────────┐        ┌──────────────────────┐
│   AIエージェント       │        │   ブラウザUI          │
│  (Claude Code等)     │        │  (React + tRPC)      │
│                      │        │                      │
│   MCP Client         │        │   tRPC Client        │
└──────┬───────────────┘        └──────┬───────────────┘
       │ stdio (JSON-RPC)              │ HTTP
       ▼                               ▼
┌──────────────────────┐        ┌──────────────────────┐
│   MCPサーバー         │        │   HTTPサーバー        │
│  (--mcp モード)       │───────▶│  (Hono + tRPC)       │
│                      │ HTTP   │                      │
│  server/src/mcp/     │        │  server/src/         │
└──────────────────────┘        └──────────────────────┘
                                       │
                                       ▼
                                ┌──────────────────────┐
                                │   SQLite DB          │
                                └──────────────────────┘
```

MCPサーバーはHTTPサーバーのtRPCエンドポイントをHTTPクライアント経由で呼び出す。
これにより、ビジネスロジックの重複を避け、単一のデータソースを維持する。

## ファイル構成

```
server/src/mcp/
├── index.ts              # MCPサーバー起動・接続
├── tools.ts              # ツール定義・ハンドラー登録
├── trpc-client.ts        # tRPC HTTPクライアント（fetch）
└── default-servers.ts    # エージェント向けデフォルトMCPサーバー設定
```

## 起動方法

### MCPサーバーとして起動

```bash
# 開発モード
cd server && bun run src/index.ts --mcp

# コンパイル済みバイナリ
./auto-kanban --mcp
```

`--mcp` フラグが付くと、HTTPサーバーは起動せず、stdioベースのMCPサーバーとして動作する。
親プロセス（AIエージェント）がstdinを閉じるまでブロックする。

### HTTPサーバーとの連携

MCPサーバーはHTTPサーバーのアドレスを以下の優先順位で解決する:

1. `AUTO_KANBAN_URL` 環境変数
2. `~/.auto-kanban/auto-kanban.port` ファイル（HTTPサーバーが起動時に書き込む）
3. フォールバック: `http://localhost:3000`

## instructions

MCPサーバーは接続時にエージェントへ `instructions` を送信する。
これはエージェントのシステムプロンプトの一部として使われ、ツールの使い方を即座に理解させる。

```
A task and project management server. If you need to create or update tickets or
tasks then use these tools. Most of them absolutely require that you pass the
`project_id` of the project that you are currently working on. You can get project
ids by using `list_projects`. Call `list_tasks` to fetch the `task_ids` of all the
tasks in a project. TOOLS: 'list_projects', 'list_tasks', 'create_task',
'start_workspace_session', 'get_task', 'update_task', 'delete_task',
'update_setup_script', 'update_cleanup_script', 'update_dev_server_script'.
Make sure to pass `project_id` or `task_id` where required. You can use list tools
to get the available ids.
```

## ツール一覧

### タスク管理

| ツール | 説明 | 必須パラメータ |
|--------|------|----------------|
| `list_projects` | プロジェクト一覧を取得 | なし |
| `list_tasks` | プロジェクト内のタスク一覧を取得（ステータスフィルター可） | `project_id` |
| `create_task` | 新しいタスクを作成 | `project_id`, `title` |
| `get_task` | タスクの詳細情報を取得 | `task_id` |
| `update_task` | タスクのタイトル・説明・ステータスを更新 | `task_id` |
| `delete_task` | タスクを削除 | `task_id` |

### ワークスペース

| ツール | 説明 | 必須パラメータ |
|--------|------|----------------|
| `start_workspace_session` | タスクに対するワークスペースセッションを作成・起動 | `task_id` |

### プロジェクト設定

| ツール | 説明 | 必須パラメータ |
|--------|------|----------------|
| `update_setup_script` | ワークスペース初期化時のセットアップスクリプトを更新 | `project_id`, `setup_script` |
| `update_cleanup_script` | ワークスペース破棄時のクリーンアップスクリプトを更新 | `project_id`, `cleanup_script` |
| `update_dev_server_script` | 開発サーバー起動スクリプトを更新 | `project_id`, `dev_server_script` |

### コンテキスト（条件付き）

| ツール | 説明 | 必須パラメータ |
|--------|------|----------------|
| `get_context` | 現在のワークスペースセッションのプロジェクト・タスク・ワークスペースメタデータを返す | なし |

`get_context` はMCPサーバー起動時のカレントディレクトリがワークスペースのworktreeパスと一致する場合のみ利用可能。

## ツールとtRPCエンドポイントの対応

MCPツールは内部でtRPCエンドポイントを呼び出す。パラメータ名はsnake_case（MCP側）からcamelCase（tRPC側）に変換される。

| MCPツール | tRPCエンドポイント | メソッド |
|-----------|-------------------|----------|
| `list_projects` | `project.list` | query |
| `list_tasks` | `task.list` | query |
| `create_task` | `task.create` | mutation |
| `get_task` | `task.get` | query |
| `update_task` | `task.update` | mutation |
| `delete_task` | `task.delete` | mutation |
| `start_workspace_session` | `execution.start` | mutation |
| `update_setup_script` | `project.update` | mutation |
| `update_cleanup_script` | `project.update` | mutation |
| `update_dev_server_script` | `project.update` | mutation |

## tRPC HTTPクライアント

`TrpcHttpClient` はMCPサーバーからHTTPサーバーへの通信に使用する軽量クライアント。
tRPCの非バッチ・非トランスフォーマーワイヤーフォーマットを使用する。

```
Query  : GET  /trpc/<proc>?input=<JSON>
Mutate : POST /trpc/<proc>  body=<JSON>
Response: { "result": { "data": <value> } }
```

## デフォルトMCPサーバー設定

Auto Kanbanはエージェント実行時に以下のMCPサーバーをデフォルトで提供する:

| 名前 | 説明 |
|------|------|
| `auto_kanban` | Auto Kanban自身（タスク管理） |
| `context7` | ライブラリドキュメント検索 |
| `playwright` | ブラウザ自動化 |
| `chrome_devtools` | Chrome DevTools連携 |

設定は `server/src/mcp/default-servers.ts` で定義される。
