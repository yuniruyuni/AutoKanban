---
id: "01KPNSHJW2EPGT866WRE7H4MM4"
name: "tasks_are_listed_for_project"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/usecases/task/list-tasks.ts`
- `server/src/usecases/task/list-tasks.test.ts` (Test)
- `server/src/presentation/trpc/routers/task.ts` (`list` procedure)
- `server/src/models/task/index.ts` (`Task.ByProject`, `Task.ByStatuses`, `Task.defaultSort`)
- `client/src/components/project/KanbanBoard.tsx`

## 機能概要

プロジェクト配下のタスクを Specification で絞り込み、カンバンボードに表示する。
`status` は単一値または配列で受け取り、配列なら `Task.ByStatuses(...)` で合成する。
デフォルトソートは `createdAt desc, id desc`、デフォルト上限は 50 件、最大 100 件。

## 主要メンバー

- `projectId: string`
- `status?: Task.Status | Task.Status[]` — 省略時は全ステータス
- `limit?: number` — 既定 50、最大 100

## シナリオ

### project の全 task 一覧

1. クライアントが `trpc.task.list({ projectId, limit: 50 })` を呼ぶ
2. `Task.ByProject(projectId)` を spec として `ctx.repos.task.list` を実行
3. `Page<Task>` (items + nextCursor + hasMore) を返却

### status でフィルタ一覧

1. `trpc.task.list({ projectId, status: ["todo", "inprogress"] })`
2. spec を `and(Task.ByProject, Task.ByStatuses("todo", "inprogress"))` で合成
3. 該当ステータスのみ返却

## 失敗 / 例外

- DB 接続エラー時のみ失敗。通常は空配列を返すのみで fail はしない
