# auto-kanban.json によるワークスペーススクリプト管理

## 概要

プロジェクトの prepare/server/cleanup スクリプトを DB カラムから `auto-kanban.json` ファイルに移行する。ファイルはプロジェクトの worktree ルートに配置し、JSONC 形式で記述する。

## 1. ファイル仕様

### 配置場所

worktree のルートディレクトリに `auto-kanban.json` として配置する。

### フォーマット

JSONC (JSON with Comments)。`//` および `/* */` コメントを許容する。

```jsonc
// auto-kanban.json
{
  // worktree作成後、エージェント実行前に実行
  "prepare": "bun install",
  // 開発サーバー起動コマンド
  "server": "bun run start:dev",
  // セッション終了時、worktree削除前に実行
  "cleanup": "rm -rf node_modules"
}
```

### フィールド

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `prepare` | `string` | No | worktree 準備時に実行するコマンド |
| `server` | `string` | No | 開発サーバー起動コマンド |
| `cleanup` | `string` | No | セッション終了・worktree 削除前に実行するコマンド |

- 全フィールドはオプショナル
- 長いスクリプトはシェルスクリプトファイルを作成して呼び出すことを推奨（例: `"prepare": "./scripts/prepare.sh"`）

### エラーハンドリング

- **ファイル不在**: エラーにせず、全スクリプト未設定（`null`）として扱う
- **パースエラー**: 警告ログを出力し、全スクリプト未設定として扱う

### 読み込み元

常に worktree のルートディレクトリから読み込む。worktree ごとに異なる設定を持つことが可能。これにより、`auto-kanban.json` 自体の変更を worktree 内で試験できる。

## 2. モデル層

### WorkspaceConfig モデル（新規）

```typescript
// server/src/models/workspace-config.ts
export interface WorkspaceConfig {
  prepare: string | null;
  server: string | null;
  cleanup: string | null;
}

export namespace WorkspaceConfig {
  export function empty(): WorkspaceConfig {
    return { prepare: null, server: null, cleanup: null };
  }
}
```

## 3. リポジトリ層

### WorkspaceConfigRepository（新規）

```typescript
// server/src/repositories/workspace-config/
export interface WorkspaceConfigRepository {
  load(workingDir: string): Promise<WorkspaceConfig>;
}
```

- `workingDir` から `auto-kanban.json` を読み込み、JSONC パースして `WorkspaceConfig` を返す
- ファイル不在 → `WorkspaceConfig.empty()` を返す
- パースエラー → 警告ログ + `WorkspaceConfig.empty()` を返す
- JSONC パースには `jsonc-parser` ライブラリを使用

## 4. JSON Schema

### スキーマファイル

`server/src/schemas/auto-kanban.schema.json` に JSON Schema を定義する。

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "auto-kanban.json",
  "description": "AutoKanban workspace configuration file",
  "type": "object",
  "properties": {
    "prepare": {
      "type": "string",
      "description": "Command to run after worktree creation, before agent execution"
    },
    "server": {
      "type": "string",
      "description": "Command to start the development server"
    },
    "cleanup": {
      "type": "string",
      "description": "Command to run before worktree deletion on session end"
    }
  },
  "additionalProperties": false
}
```

### MCP リソースとしての配信

MCP サーバーに `resources` capability を追加し、`auto-kanban-schema` リソースとしてスキーマを配信する。エージェントがスキーマを参照して `auto-kanban.json` の生成・検証に利用できる。

## 5. 削除対象

### DB

- `projects` テーブルから `setup_script`, `dev_server_script`, `cleanup_script` カラムを削除（マイグレーション）

### サーバー

- `Project` モデルから `setupScript`, `devServerScript`, `cleanupScript` フィールドを削除
- `project` リポジトリの upsert/select からスクリプト関連カラムを除去
- MCP ツール `update_setup_script`, `update_dev_server_script`, `update_cleanup_script` を削除
- tRPC `project.update` の input からスクリプト関連フィールドを削除
- `updateProject` usecase からスクリプト更新ロジックを削除

### クライアント

- `ProjectApiResponse` / `ProjectClientModel` からスクリプトフィールドを削除
- `useProjects` hook の `UpdateProjectInput` からスクリプトフィールドを削除
- `ProjectsPage` の edit フォームから `devScript` を削除

## 6. 利用側の変更

スクリプト実行が必要な箇所で `WorkspaceConfigRepository.load(workingDir)` を呼び出す。

### devServer 起動（既存の変更）

```typescript
// start-dev-server usecase
// before: project.devServerScript
// after:
const config = await ctx.repos.workspaceConfig.load(workingDir);
if (!config.server) {
  return { error: "NO_DEV_SERVER_SCRIPT" };
}
// config.server を使って devServer を起動
```

### prepare/cleanup 実行（新規 usecase）

- `run-prepare-script` usecase: worktree パスから `WorkspaceConfig` を読み込み、`config.prepare` を `ExecutionProcess`（`runReason: "setupscript"`）として実行
- `run-cleanup-script` usecase: 同様に `config.cleanup` を `ExecutionProcess`（`runReason: "cleanupscript"`）として実行

## 7. MCP Instructions の更新

MCP サーバーの instructions に以下を追記:

> プロジェクトのワークスペース設定は `auto-kanban.json` ファイル（JSONC形式）で管理される。このファイルはプロジェクトの worktree ルートに配置し、`prepare`（準備コマンド）、`server`（開発サーバー起動コマンド）、`cleanup`（後片付けコマンド）を定義する。スキーマは MCP リソース `auto-kanban-schema` で参照可能。

## 8. Task Details Fullscreen UI — Workspace タブ

### 概要

Task details fullscreen の右パネルに「Workspace」タブ（4番目）を追加する。prepare と cleanup は同一のワークスペースセッションを共有し、排他的に実行される（同時実行不可）。ログビューアも統一し、実行履歴を一連の流れとして表示する。

### UI 構成

- **アクションバー**: 「Prepare」ボタン（Primary）、「Cleanup」ボタン（Secondary）、ステータスバッジ、右端に `auto-kanban.json` リンク
- **統一ログビューア**: prepare/cleanup 共通のターミナル風ログ表示。実行コマンド名（`$ prepare` / `$ cleanup`）をヘッダーとして表示し、以降にリアルタイムログをストリーミング

### 排他制御

- prepare または cleanup のいずれかが実行中の場合、両方のボタンを無効化する
- 実行完了後にボタンが再度有効になる

### 動作

1. ボタンクリックで tRPC mutation を呼び出す（`execution.runPrepare` / `execution.runCleanup`）
2. サーバー側で該当タスクの worktree パスを取得
3. `WorkspaceConfigRepository.load(workingDir)` でスクリプトを読み込む
4. `ExecutionProcess` を作成（`runReason: "setupscript"` / `"cleanupscript"`）し、`Bun.spawn` で実行
5. ログは `LogCollector` + SSE `/sse/logs/:executionProcessId` でストリーミングし、クライアント側で `useLogStream` hook + `LogViewer` コンポーネントで表示

### tRPC エンドポイント

- `execution.runPrepare`: `{ taskId: string }` → `{ executionProcessId: string }`
- `execution.runCleanup`: `{ taskId: string }` → `{ executionProcessId: string }`

### ログの表示

- 実行中: リアルタイムストリーミング
- 実行完了後: DB に保存されたログを表示（`executionProcessId` で参照）
- 過去の実行履歴は `ExecutionProcess` レコードから時系列で参照可能
