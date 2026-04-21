---
id: "01KPNSHJW89KPCWYXKE4E261H9"
name: "task_is_deleted_with_optional_worktree_cleanup"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/usecases/task/delete-task.ts`
- `server/src/usecases/task/delete-task.test.ts` (Test)
- `server/src/usecases/run-cleanup-before-removal.ts`
- `server/src/presentation/trpc/routers/task.ts` (`delete` procedure)

## 機能概要

タスクとその配下のエンティティを逆依存順にカスケード削除する。
`deleteWorktrees: true` を指定すると、post ステップで各 workspace の cleanup スクリプトを実行後、
worktree を物理削除する（ブランチも削除される）。

削除順序: `approval` + `coding_agent_turn` + `coding_agent_process_logs` →
`dev_server_process_logs` → `workspace_script_process_logs` →
`coding_agent_process` + `dev_server_process` + `workspace_script_process` →
`session` → `workspace_repo` → `workspace` → `task`。

## 設計意図

`delete-project` の縮小版。プロジェクトの削除と違い、タスク削除では **親 project は削除しない**
ため `workspace_repo` の project 側リレーションは残す。

## 主要メンバー

- `taskId: string`
- `deleteWorktrees?: boolean` — 既定 `false`

## シナリオ

### DB-only delete

1. `trpc.task.delete({ taskId, deleteWorktrees: false })`
2. `read` で task / project / 関連 ID 一式を集約
3. `write` で逆依存順にカスケード削除
4. `post` は何もしない
5. `{ deleted: true, taskId }` を返却

### Delete with worktree cleanup

1. `deleteWorktrees: true`
2. write までは通常と同じ
3. `post` で各 workspace の worktree が存在すれば:
   - `runCleanupIfConfigured` で cleanup スクリプトを実行
   - `worktree.removeAllWorktrees(wsId, [project], true)` で強制削除（ブランチ含む）
4. 個別の worktree 削除が失敗しても try/catch でログ出力のみ

## 失敗 / 例外

- `NOT_FOUND` — `taskId` のタスクが存在しない
- `NOT_FOUND` — 親 Project が存在しない（孤児 task：不整合）
- worktree 削除失敗は warning ログのみ
