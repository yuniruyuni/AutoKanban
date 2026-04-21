---
id: "01KPNSHJW3JZ7Y5SF7TBX5HTYC"
name: "task_detail_is_fetched"
status: "draft"
---

## 関連ファイル

- `server/src/usecases/task/get-task.ts`
- `server/src/usecases/task/get-task.test.ts` (Test)
- `server/src/presentation/trpc/routers/task.ts` (`get` procedure)
- `client/src/components/task/TaskDetailPanel.tsx`

## 機能概要

単一タスクの詳細を `taskId` で取得する。タスクサイドパネルやフルスクリーン画面の初期ロードで使用される。

## シナリオ

### Successful fetch

1. クライアントが `trpc.task.get({ taskId })` を呼ぶ
2. `read` で `Task.ById(taskId)` を取得
3. `Task` をそのまま返却

### Not found

1. 存在しない `taskId`
2. `fail("NOT_FOUND", "Task not found", { taskId })`

## 失敗 / 例外

- `NOT_FOUND` — 指定 `taskId` のタスクが存在しない
