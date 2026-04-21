---
id: "01KPNSHJW5PQ99GFB1W694PSZ6"
name: "task_is_updated"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/usecases/task/update-task.ts`
- `server/src/usecases/task/update-task.test.ts` (Test)
- `server/src/presentation/trpc/routers/task.ts` (`update` procedure)
- `server/src/models/task/index.ts` (`Task.canTransition`, `Task.needsChatReset`)
- `server/src/usecases/run-cleanup-before-removal.ts`

## 機能概要

タスクの `title` / `description` / `status` を部分更新する。`status` 変更時は
`Task.canTransition` でバリデーションを行い（**AutoKanban は全状態間の遷移を許可するため実質常に true**）、
`status === "todo"` への遷移時は "Chat Reset" 副作用として全 workspace を archive、worktree を削除する。

## 設計意図

`updateTask` はタスク更新の単一エンドポイントだが、`status` 変更は 3 つの副作用を持つ:
(1) `canTransition` バリデーション、(2) `needsChatReset` の場合の workspace archive + worktree 削除、
(3) クライアント側で agent 起動 / stop のトリガー（UI 層の責務）。
このうち (1)(2) がこのユースケースの範囲。(3) は UI の `task_transitions_to_inprogress_and_starts_agent` を参照。

詳細な遷移ルールは [`task_kanban_dnd_transitions_trigger_side_effects`](../ui-kanban/task_kanban_dnd_transitions_trigger_side_effects.md) に集約。

## 主要メンバー

- `taskId: string`
- `title?: string`
- `description?: string | null`
- `status?: Task.Status`

## シナリオ

### 純粋なフィールド更新（status 変更なし）

1. `trpc.task.update({ taskId, title })` のように status を含めずに呼ぶ
2. `read` で task を取得、`needsChatReset: false`
3. `process` で指定フィールドだけマージ、`updatedAt: ctx.now`
4. `write` で upsert、post はスキップ
5. 更新後の `Task` を返却

### `todo` への status 変更（chat reset）

1. 現在 `inprogress` のタスクを `todo` に更新
2. `read` で `needsChatReset: true`、project と全 workspace を取得
3. `process` で status 遷移のバリデーション、status 変更を含めてマージ
4. `write` で task を upsert、全 workspace に `archived: true` をセットして upsert
5. `post` で各 workspace の worktree を削除（cleanup スクリプトを実行後、ブランチは保持）
6. `worktree.pruneWorktrees(project)` でゴミ entry を整理

## 失敗 / 例外

- `NOT_FOUND` — 指定 `taskId` のタスクが存在しない
- `INVALID_TRANSITION` — 遷移が許可されていない（現行実装では発生しない）
- worktree 削除 / prune の失敗は warning ログのみ（usecase は成功扱い）
