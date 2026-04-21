---
id: "01KPNSJ3RVKCWCSPCAJTEKT2QZ"
name: "pull_request_is_created_and_finalized"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/usecases/git/create-pull-request.ts`
- `server/src/usecases/git/finalize-pr-merge.ts`
- `server/src/presentation/trpc/routers/git.ts`
- `server/src/models/draft-pull-request/`
- `server/src/models/workspace-repo/index.ts` (`prUrl` フィールド)

## 機能概要

タスクの作業ブランチから GitHub Pull Request を作成し、作成後は
`workspace_repo.prUrl` に URL を保存する。
Merge 後には `finalize-pr-merge` を呼ぶと関連 worktree を自動で掃除する。

## 設計意図

PR 作成は `gh` CLI 相当を呼ぶ（実装は git Repository 層）。
PR 説明は [`pr_description_is_generated_and_streamed`](./pr_description_is_generated_and_streamed.md)
で LLM による生成ができ、finalize はタスクを `done` に遷移させる副作用も持つ。

## シナリオ

### PR 作成

1. タスク完了後、ユーザーが「Create PR」ボタンを押す
2. `trpc.git.createPullRequest({ workspaceId, title, body?, draft? })`
3. `gh pr create` 相当を実行、PR URL を取得
4. `workspaceRepo` の `prUrl` を更新

### マージ後の finalize

1. PR が GitHub 側で merge された後、ユーザーが「Finalize」を押す
2. `trpc.git.finalizePrMerge({ workspaceId })`
3. worktree を cleanup スクリプト実行 → 削除（ブランチも削除）
4. タスクを `done` に遷移

## 失敗 / 例外

- `NOT_FOUND` — workspace / project
- `GIT_ERROR` / `GH_CLI_ERROR` — `gh` コマンド失敗（認証、権限、ネット）
- 既に PR 作成済みの場合は既存 URL を返して fail しない
