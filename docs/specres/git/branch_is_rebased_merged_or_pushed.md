---
id: "01KPNSJ3RSQGHS2F76VKN16QZM"
name: "branch_is_rebased_merged_or_pushed"
status: "draft"
---

## 関連ファイル

- `server/src/usecases/git/rebase-branch.ts`, `abort-rebase.ts`, `continue-rebase.ts`
- `server/src/usecases/git/merge-branch.ts`
- `server/src/usecases/git/push-branch.ts`
- `server/src/presentation/trpc/routers/git.ts`
- `server/src/repositories/git/`

## 機能概要

タスクのブランチに対する Git 操作 3 種を扱う:
- **rebase**: `targetBranch`（通常 `main`）の上に現在のブランチを rebase。競合したら `abort-rebase` か
  `continue-rebase` で解消
- **merge**: `main` に fast-forward merge（非 ff は拒否 — `.claude/rules/task-states.md` 参照）
- **push**: remote に push（force は未対応）

## 設計意図

- **merge は fast-forward only**: AutoKanban は「AI が別ブランチで作業 → main に早送りで merge」を
  前提とし、merge commit や conflict 解消は避ける。これにより履歴が常に線形に保たれる
- **rebase conflict は手動介入**: 自動解消を試みず、abort / continue のどちらかを明示させる
- Git 操作はすべて worktree 内で行い、プロジェクトのメインコピーには触らない

## シナリオ

### Rebase onto main

1. `trpc.git.rebase({ workspaceId, targetBranch: "main" })`
2. `rebase-branch` が `git rebase origin/main` を実行
3. 成功なら new HEAD を返す
4. 競合時は `{ conflicted: true, files: [...] }` を返す

### Abort / continue rebase

1. 競合状態で `trpc.git.abortRebase({ workspaceId })` → `git rebase --abort`
2. または `trpc.git.continueRebase({ workspaceId })` → ユーザーが手動解消後に呼び出し

### Merge to main (fast-forward only)

1. `trpc.git.merge({ workspaceId })`
2. target ブランチに切り替え `git merge --ff-only <sourceBranch>`
3. 非 FF 可能だったら `fail("NOT_FAST_FORWARDABLE")`

### Push to remote

1. `trpc.git.push({ workspaceId })`
2. `git push origin <branch>` を実行
3. 認証エラー等は Repository 層で標準化

## 失敗 / 例外

- `NOT_FOUND` — workspace / project が見つからない
- `CONFLICT` — rebase conflict（詳細は details.files）
- `NOT_FAST_FORWARDABLE` — merge が fast-forward 不可能
- Git コマンドの失敗全般は `GIT_ERROR` にまとめて返す
