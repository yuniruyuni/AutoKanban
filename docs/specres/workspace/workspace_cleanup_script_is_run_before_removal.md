---
id: "01KPNSJ3QDCVVJXS9QES8YWY99"
name: "workspace_cleanup_script_is_run_before_removal"
status: "draft"
---

## 関連ファイル

- `server/src/usecases/run-cleanup-before-removal.ts` (`runCleanupIfConfigured`)
- `server/src/usecases/workspace/run-workspace-script.ts` (手動経路)
- `server/src/usecases/project/delete-project.ts` (project 削除時の post)
- `server/src/usecases/task/delete-task.ts` (task 削除時の post)
- `server/src/usecases/task/update-task.ts` (Chat Reset 時の post)

## 機能概要

worktree を物理削除する前に `auto-kanban.json` の `cleanup` スクリプトを実行する。
失敗しても **削除処理はブロックしない**（best-effort）。
呼び出し側は `run-cleanup-before-removal.ts` の `runCleanupIfConfigured(repos, logger, worktreePath)` を
使って一律に発火させる。

## 設計意図

cleanup は「停止中の watcher を落とす」「外部プロセスに signal を送る」といった、
worktree を消す前に片付けておきたいことを記述するためのフック。
失敗で削除自体を止めると「スタックした worktree」が増えるため、
exit code 非 0 でも warning ログだけ残して続行する。

## シナリオ

### Cleanup on project deletion

1. `deleteProject({ deleteWorktrees: true })` の post ステップ
2. 各 workspace について `worktree.worktreeExists` を確認
3. 存在すれば `runCleanupIfConfigured(...)` を呼ぶ
4. `workspaceConfig.load` で設定を読み、`config.cleanup` があれば `scriptRunner.run`
5. 結果は logger に書くのみ
6. 続けて `worktree.removeAllWorktrees(..., deleteBranch: true)` で worktree を消す

### Cleanup on chat reset (todo transition)

1. `updateTask({ status: "todo" })` の post ステップ
2. 各 archive 対象 workspace について同じ流れ
3. ただし `removeAllWorktrees(..., deleteBranch: false)` でブランチは残す

### Cleanup not configured

1. `auto-kanban.json` が無い or `cleanup` キーが無い
2. `runCleanupIfConfigured` は silently return、warning ログも出さない

## 失敗 / 例外

- 失敗はすべて warning ログのみ（usecase の結果には影響しない）
