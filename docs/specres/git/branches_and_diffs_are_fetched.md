---
id: "01KPNSJ3RR53PPC1KAWR4HB2PP"
name: "branches_and_diffs_are_fetched"
status: "draft"
---

## 関連ファイル

- `server/src/usecases/git/list-branches.ts`
- `server/src/usecases/git/get-branch-status.ts`
- `server/src/usecases/git/get-diffs.ts`
- `server/src/usecases/git/get-file-diff.ts`
- `server/src/presentation/trpc/routers/git.ts`
- `server/src/models/branch-status/`
- `server/src/models/git-diff/`
- `client/src/components/task/diff-panel/DiffPanel.tsx`

## 機能概要

タスクの worktree に対して Git 情報を問い合わせる API 群。
- `listBranches(repoPath)` — プロジェクト内の全ブランチ
- `getBranchStatus(workspaceId)` — `ahead / behind / dirty` 等の簡易状態
- `getDiffs(workspaceId)` — 変更ファイル一覧（`unstaged`, `staged`, `untracked` を含む）
- `getFileDiff(workspaceId, path)` — 単一ファイルの行単位 diff

UI の DiffPanel はこれらを組み合わせて「変更サマリー + ファイルツリー + 差分ビュー」を描画する。

## 設計意図

Git 操作はすべて **worktree 単位**で行い、プロジェクトのメインリポジトリには副作用を及ぼさない。
`branch_status` は軽量（ahead/behind/dirty のサマリー）、`get-diffs` は中量（ファイル一覧）、
`get-file-diff` は個別ファイル詳細、と粒度を分けて必要な時にだけ高コストな計算を行う。

## シナリオ

### List branches

1. NewProjectPage や BranchSelector が `trpc.git.listBranches({ projectId })`
2. repoPath で `git branch --list --all` 相当を実行し名前配列を返す

### Get branch status for a workspace

1. タスク詳細パネルを開いた時 `trpc.git.getBranchStatus({ workspaceId })`
2. worktree 内で `git status --porcelain` + `git rev-list --count <upstream>..HEAD` 相当を集約
3. `{ ahead, behind, dirty, untracked }` を返す

### Get file diffs

1. DiffPanel が `trpc.git.getDiffs({ workspaceId })` でファイル一覧
2. ユーザーがファイルをクリックしたら `trpc.git.getFileDiff({ workspaceId, path })` で詳細

## 失敗 / 例外

- `NOT_FOUND` — workspace / project のいずれか欠如
- Git コマンドの失敗は Repository 層で捕捉して標準化された error code に正規化
