---
id: "01KPPZWHXZBF4J3P7QB0C67VCP"
name: "workspace_config_is_auto_kanban_json"
status: "draft"
---

## 関連ファイル

- `server/src/models/workspace-config/` (`WorkspaceConfig` 型)
- `server/src/repositories/workspace-config/` (`load(workingDir)` 実装)
- `server/src/schemas/auto-kanban.schema.json` (JSON Schema)
- `server/src/presentation/mcp/routers/tools.ts`（MCP resource `auto-kanban-schema` 配信）
- 利用側: `server/src/usecases/execution/start-execution.ts` (prepare)、
  `server/src/usecases/dev-server/start-dev-server.ts` (server)、
  `server/src/usecases/run-cleanup-before-removal.ts` (cleanup)、
  `server/src/usecases/workspace/run-workspace-script.ts` (手動 prepare/cleanup)

## 機能概要

Workspace 内で走らせる 3 種類のスクリプトは、DB ではなく **プロジェクトの worktree ルートに
置かれる `auto-kanban.json` ファイル**で宣言される。

```jsonc
// auto-kanban.json (JSONC)
{
  "prepare": "bun install",
  "server":  "bun run start:dev",
  "cleanup": "rm -rf node_modules"
}
```

- `prepare`: worktree 作成直後、エージェント実行の前に自動実行（失敗するとエージェントは起動しない）
- `server`: 開発サーバー起動コマンド（dev-server ドメインで扱う）
- `cleanup`: worktree 削除前に実行（best-effort、失敗しても削除は進む）

**ファイル不在 or パースエラーは全フィールド `null` として扱い、起動をブロックしない**。

## 設計意図

- **worktree ごとに独立した設定**: 同じプロジェクトの別 attempt で `prepare` を書き換えて
  実験できる。DB カラムだと全 workspace で共有されるので、試行錯誤の粒度が合わない
- **エージェントが直接編集できる**: プロジェクト内のファイルなので、Coding Agent が
  `auto-kanban.json` を編集・新規作成するのは自然な操作。MCP resource として
  JSON Schema を配信することで、エージェントがスキーマを参照しながら書ける
- **JSON Schema で UI / IDE 支援**: `auto-kanban.schema.json` を MCP resource
  `auto-kanban-schema` として配信。エディタでの補完やバリデーションに使える
- **ファイル不在に寛容**: 小さなプロジェクトでは `auto-kanban.json` 無しでもエージェント起動
  できる。`prepare` が無ければスキップ、`server` が無ければ dev-server 機能が使えないだけ

### 経緯 (旧 ADR-0010 吸収 + ADR-0009 関連)

- 初期は `projects` テーブルに `setup_script` / `dev_server_script` / `cleanup_script` カラムを
  持たせていた
- DB 側で管理することには次の問題があった: (1) 同じプロジェクト内の workspace 間で設定が
  共有され個別に試せない、(2) AI エージェントが設定を変更するには tRPC 経由の update が
  必要で煩雑、(3) スキーマ変更が必要なとき SQLite の `ALTER TABLE` 制限に引っかかった
- auto-kanban.json 化は上記 3 点を同時に解決する。後日 `postgresql_is_embedded_for_storage`
  に移行したことで (3) は事後的に解消されたが、(1)(2) の理由で JSON 化は維持

## 検討された代替案

- **DB カラムで保持**（元の設計）: 上記 3 点の問題で陳腐化
- **`package.json` の `scripts` セクションに相乗り**: 既存の npm scripts と混ざると
  semantic が不明瞭（`prepare` は npm 側にも意味がある）。独立ファイルで衝突回避
- **ディレクトリ設定（`.auto-kanban/config.json` 等）**: ディレクトリ構造が重いので単一ファイル

## 主要メンバー

- `WorkspaceConfig` モデル: `{ prepare: string | null, server: string | null, cleanup: string | null }`
- `WorkspaceConfigRepository.load(workingDir): Promise<WorkspaceConfig>`: JSONC パース
  （`jsonc-parser` 使用）、失敗時は `WorkspaceConfig.empty()`
- JSON Schema: `server/src/schemas/auto-kanban.schema.json`
- MCP resource: `auto-kanban-schema`

## 関連する動作

- [workspace_prepare_script_is_run](../workspace/workspace_prepare_script_is_run.md)
- [workspace_cleanup_script_is_run_before_removal](../workspace/workspace_cleanup_script_is_run_before_removal.md)
- [dev_server_lifecycle_is_managed](../dev-server/dev_server_lifecycle_is_managed.md)
- [dev_server_process_is_a_worktree_scoped_server](../dev-server/dev_server_process_is_a_worktree_scoped_server.md)
