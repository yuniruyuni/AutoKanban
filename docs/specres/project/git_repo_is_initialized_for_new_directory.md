---
id: "01KPNTBSGDD1B05FV65HVPERRT"
name: "git_repo_is_initialized_for_new_directory"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/usecases/project/init-git-repo.ts`
- `server/src/usecases/project/init-commit.ts`
- `server/src/usecases/project/get-git-info.ts`
- `server/src/presentation/trpc/routers/project.ts` (`initGitRepo`, `initCommit`, `getGitInfo`)
- `client/src/pages/NewProjectPage.tsx`

## 機能概要

FileBrowser で選んだディレクトリが Git リポジトリでなかった場合に、
ユーザーが `git init` + 初回コミットをその場で行えるようにする API 群。
- `getGitInfo(path)` — `isGitRepo`, `branches`, `currentBranch` を返して UI で「Git 化が必要」と判断
- `initGitRepo(path, defaultBranch?)` — `git init [--initial-branch=<defaultBranch>]`
- `initCommit(path)` — 全ファイルを `git add` → 空リポジトリに対して初回コミット

## 設計意図

`createProject` の post ステップで「Git リポジトリでない」「コミットがない」と
fail するが、その前段のウィザード UI で修復できるようにする。
初回 commit の author は Git の global config に依存。

## シナリオ

### Detect & offer init

1. `trpc.project.getGitInfo({ path })` が `{ isGitRepo: false }` を返す
2. UI は「Initialize Git」ボタンを表示
3. ユーザーが押すと `trpc.project.initGitRepo({ path, defaultBranch: "main" })`
4. 続けて `trpc.project.initCommit({ path })` で初回コミット
5. 再度 `getGitInfo` して `isGitRepo: true` を確認してから CreateProject へ進む

## 失敗 / 例外

- `git init` が失敗（disk full, permission denied）→ stderr を UI に表示
- 既に Git リポジトリだった場合は `initGitRepo` は no-op で成功を返す
