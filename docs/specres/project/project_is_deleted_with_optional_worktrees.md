---
id: "01KPNSHJVXRAQGH9C3HBFX3X2F"
name: "project_is_deleted_with_optional_worktrees"
status: "draft"
---

## 関連ファイル

- `server/src/usecases/project/delete-project.ts`
- `server/src/usecases/run-cleanup-before-removal.ts`
- `server/src/presentation/trpc/routers/project.ts` (`delete` procedure)
- `server/src/repositories/worktree/`

## 機能概要

プロジェクトを削除する。関連する `task / workspace / session / coding_agent_process /
dev_server_process / workspace_script_process / approval / coding_agent_turn /
coding_agent_process_logs / workspace_repo` を逆依存順でカスケード削除する。
`deleteWorktrees: true` を指定すると、post ステップで各 workspace の cleanup スクリプトを
実行してから worktree を物理削除し、最後に `git worktree prune` を走らせる。

## 設計意図

DB の外部キー制約に頼らず、usecase 内で明示的にカスケードする理由:
(1) 削除順序のビジネスルール（`approval` より先に `coding_agent_process` を消すと FK 違反）を
明文化する、(2) worktree 削除など External I/O を post ステップに分離して
トランザクションを引き伸ばさない、(3) cleanup スクリプトの失敗は警告ログのみで
削除処理自体は継続させる（stuck なプロジェクトを放置しない）。

## 主要メンバー

- `projectId: string`
- `deleteWorktrees?: boolean` — 既定 `false`（DB レコードだけ削除し、worktree は手動クリーンアップ）

## シナリオ

### Successful delete (DB only)

1. `trpc.project.delete({ projectId, deleteWorktrees: false })`
2. `read` で project の存在確認と関連 entity の ID を集約
3. `write` で子から順に delete → 最後に `Project.ById` で project 本体を削除
4. post では何もしない
5. `{ deleted: true, projectId }` を返却

### Delete with worktrees

1. `deleteWorktrees: true`
2. write までは通常と同じ
3. post ステップで、収集した `workspaceIds` ごとに:
   - `worktree.worktreeExists` を確認
   - 存在すれば `runCleanupIfConfigured` で cleanup スクリプトを実行
   - `worktree.removeAllWorktrees(wsId, [project], true)` で強制削除
4. `worktree.pruneWorktrees(project)` で Git 管理上のゴミ entry を掃除
5. 個別の worktree 削除が失敗しても try/catch で握りつぶしてログ出力のみ

## 失敗 / 例外

- `NOT_FOUND` — 指定 `projectId` のプロジェクトが存在しない
- worktree 削除 / prune の失敗は warning ログのみ（usecase は成功扱い）
