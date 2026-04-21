---
id: "01KPNTBSG00XN1PFDMY201CH8A"
name: "templates_are_listed_and_created"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/usecases/task-template/list-task-templates.ts`
- `server/src/usecases/task-template/create-task-template.ts`
- `server/src/usecases/task-template/update-task-template.ts`
- `server/src/usecases/task-template/delete-task-template.ts`
- `server/src/usecases/setup/seed-templates.ts` (初回起動時の seed)
- `server/src/presentation/trpc/routers/task-template.ts`
- `server/src/models/task-template/index.ts`
- `client/src/pages/settings/TaskTemplatePage.tsx`

## 機能概要

タスクテンプレート（プロジェクト作成時に自動で生成される初期タスクの雛形）の CRUD を扱う。
各テンプレートは `{ title, description, condition, sortOrder }` を持ち、
`condition` が `null` なら常時適用、`"no_dev_server"` なら
`auto-kanban.json` に `server` スクリプトがある場合のみスキップ、など applicability 制御がある。

## シナリオ

### 設定ページから一覧・作成

1. `/settings/task-templates` で `trpc.taskTemplate.list` / `create` / `update` / `delete`
2. UI で title / description / condition / sortOrder を入力・並び替え

### 初回起動時の seed

1. アプリ初回起動時に `setup/seed-templates.ts` がデフォルトテンプレートを挿入
2. ユーザーが削除した後に再 seed はされない（冪等性は初回のみ）

### project 作成時の適用

1. `createProject` の write ステップで `taskTemplate.listAll` → condition を評価
2. 条件に合うテンプレートだけから初期タスクを `Task.create` で生成

## 失敗 / 例外

- 通常は fail なし、空配列を返す
