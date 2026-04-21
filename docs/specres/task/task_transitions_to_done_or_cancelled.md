---
id: "01KPNSHJWFA8DAP0KD9FW19H4Q"
name: "task_transitions_to_done_or_cancelled"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/models/task/index.ts` (`Task.toDone`, `Task.canTransition`)
- `server/src/usecases/task/update-task.ts`
- `server/src/usecases/execution/on-process-complete.ts`
- `client/src/components/project/KanbanBoard.tsx`

## 機能概要

タスクの終了状態への遷移。`done` / `cancelled` のどちらも他のすべての状態から遷移可能。
`Task.toDone(task)` は `status !== "done"` のとき `done` に変換するヘルパーで、
冪等性を保つ。`cancelled` は通常の `updateTask(status: "cancelled")` でよい。

## 設計意図

終了状態を 2 つ用意する理由: **意図的に中止した（cancelled）** と **完了した（done）** を
カンバン上で区別するため。`done` は自動化経路（agent プロセス完了時の
[`process_completion_updates_task_status`](../callback/process_completion_updates_task_status.md)）
で代入される場合もある。

## 主要メンバー

- `Task.toDone(task): Task | null` — `done` 以外からの遷移。既に `done` なら `null`
- 手動キャンセル: `trpc.task.update({ status: "cancelled" })`
- 自動完了: callback 経由で `update-task` が呼ばれる

## シナリオ

### Manual done

1. ユーザーが `inprogress` のタスクを `done` にドラッグ
2. `trpc.task.update({ taskId, status: "done" })`
3. `needsChatReset: false`（chat reset は `todo` への遷移のみ）
4. task を upsert、workspace には触らない

### Manual cancel

1. ユーザーが任意の状態から `cancelled` に遷移
2. workspace は archive されない（`cancelled` は `needsChatReset` の対象外）
3. 再開したい場合は別の状態に戻すだけでよい

### Automatic done from agent completion

1. Executor プロセスが exit code 0 で終了
2. `on-process-complete` callback が発火
3. [`process_completion_updates_task_status`](../callback/process_completion_updates_task_status.md) の
   ルールに従って自動で `done` へ遷移する

## 失敗 / 例外

- `NOT_FOUND` — 指定 `taskId` のタスクが存在しない
- 現行実装では `INVALID_TRANSITION` は発生しない（全遷移許可）
