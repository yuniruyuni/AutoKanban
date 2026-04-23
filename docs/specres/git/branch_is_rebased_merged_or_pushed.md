---
id: "01KPNSJ3RSQGHS2F76VKN16QZM"
name: "branch_is_rebased_merged_or_pushed"
status: "stable"
last_verified: "2026-04-23"
---

## 関連ファイル

- `server/src/usecases/git/rebase-branch.ts`, `abort-rebase.ts`, `continue-rebase.ts`,
  `resolve-rebase-conflict.ts`
- `server/src/usecases/git/merge-branch.ts`
- `server/src/usecases/git/push-branch.ts`
- `server/src/presentation/trpc/routers/git.ts`
- `server/src/repositories/git/`
- `client/src/components/task/GitOperationButtons.tsx`（rebase → conflict → agent の連鎖）

## 機能概要

タスクのブランチに対する Git 操作 3 種を扱う:
- **rebase**: `targetBranch`（通常 `main` の `origin` 側最新）に対して現在のブランチを rebase。
  競合したら Coding Agent に自動でハンドオフして解消を試み、どうしても解消できない場合のみ
  ユーザに指示を仰ぐ（`abort-rebase` / `continue-rebase` でも手動 override 可能）
- **merge**: `main` に fast-forward merge（非 ff は拒否 — `.claude/rules/task-states.md` 参照）
- **push**: remote に push（force は未対応）

## 設計意図

- **merge は fast-forward only**: AutoKanban は「AI が別ブランチで作業 → main に早送りで merge」を
  前提とし、merge commit や conflict 解消は避ける。これにより履歴が常に線形に保たれる
- **rebase conflict は agent が自律解決**: conflict 発生時に task の既存 session へ follow-up
  message を送る。agent は worktree 内で marker を読み、編集し、`git add` して `git rebase --continue`
  まで進める。判断できない hunk があれば最後のメッセージでユーザに問い合わせて止まる（通常の
  「待機中 turn」と同じ挙動）。ユーザが editor で手作業に切り替えることも任意（通常 task と同じ介入）
- **base ref は `origin/<branch>` を優先解決**: ローカル branch ref は `git fetch origin` で
  更新されないため、rebase / diff / ahead-behind はすべて `origin/<base>` が存在すればそちらを
  解決先として使う（`refs/remotes/origin/*` 未登録のローカル専用 repo だけローカル ref に fallback）
- **diff は `<base>...HEAD` 範囲**: merge-base からの差分だけ見せるので、base 側に進んだコミットが
  「逆向きの追加」として紛れ込まない
- Git 操作はすべて worktree 内で行い、プロジェクトのメインコピーには触らない

## シナリオ

### main への rebase（clean 完走ケース）

1. `trpc.git.rebase({ workspaceId, projectId, newBaseBranch: "main" })`
2. `rebase-branch` usecase が fetch → `git rebase --autostash origin/main`（ローカル ref が
   stale でも origin/main 基準で動く）
3. 成功なら `{ success: true, hasConflicts: false }`

### rebase conflict → agent が解消

1. 上記 2 で conflict → `{ success: false, hasConflicts: true, conflictedFiles: [...] }`
2. 呼び出し側（client の `GitOperationButtons.handleRebase`）が続けて
   `trpc.git.resolveRebaseConflict({ workspaceId, projectId })` を発火
3. `resolve-rebase-conflict` usecase が workspace の最新 session に対して conflict 解消指示の
   follow-up prompt（target branch + conflicted files + 手順）を `messageQueue` 経由で送る
4. agent が worktree 内で marker を読み、編集し、`git add` → `git rebase --continue` を実行
5. `--continue` で新たな conflict が出たら agent が再度手順を繰り返す（prompt に loop 指示が入っている）
6. agent が解消不能と判断したら、最後のメッセージで状況と選択肢をユーザに提示して turn を終える
   （既存の「待機中 turn」と同じ状態。ユーザは chat で返信するか、手動で編集してから
   `continueRebase` / `abortRebase` を呼べる）

### rebase を手動で abort / continue

1. 競合状態で `trpc.git.abortRebase({ workspaceId })` → `git rebase --abort`
2. もしくは手で解消後に `trpc.git.continueRebase({ workspaceId })` → `git rebase --continue`
3. agent 実行中でもユーザはいつでも `abort-rebase` で override できる

### main への merge（fast-forward のみ）

1. `trpc.git.merge({ workspaceId })`
2. target ブランチに切り替え `git merge --ff-only <sourceBranch>`
3. 非 FF 可能だったら `fail("NOT_FAST_FORWARDABLE")`

### remote に push

1. `trpc.git.push({ workspaceId })`
2. `git push origin <branch>` を実行
3. 認証エラー等は Repository 層で標準化

## 失敗 / 例外

- `NOT_FOUND` — workspace / project が見つからない
- `CONFLICT` — rebase conflict（詳細は details.files）
- `NOT_FAST_FORWARDABLE` — merge が fast-forward 不可能
- Git コマンドの失敗全般は `GIT_ERROR` にまとめて返す
