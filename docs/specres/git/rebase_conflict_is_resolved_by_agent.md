---
id: "01KPX8ZRJMGPQS2DPB2GRN2HJT"
name: "rebase_conflict_is_resolved_by_agent"
status: "stable"
last_verified: "2026-04-23"
---

## 関連ファイル

- `server/src/usecases/git/resolve-rebase-conflict.ts`
- `server/src/usecases/git/resolve-rebase-conflict.test.ts`
- `server/src/presentation/trpc/routers/git.ts`（`resolveRebaseConflict` procedure）
- `client/src/hooks/git/useGitMutations.ts`（mutation hook）
- `client/src/components/task/GitOperationButtons.tsx`（rebase → conflict → 自動呼び出しの連鎖）

## 機能概要

`git rebase` が conflict した worktree に対して、task の既存 Coding Agent session に
「conflict を解消して rebase を完了させてほしい」という follow-up message を送る。agent は
worktree 内で marker を読み、編集し、`git add` → `git rebase --continue` を繰り返し、rebase を
clean に完走させる。解消できない場合は通常の「待機中 turn」と同じくユーザ問い合わせで停止する。

内部実装は `queueMessage` と同構造（session の最新 process 状態に応じて即送信 / 新 process 起動 /
キュー登録を振り分ける）。違いは prompt がライブ rebase 状態（target branch + conflicted files）
から組み立てられる点だけ。

## 設計意図

- **agent が自律で完了まで進める**: rebase conflict は通常 agent が解消できる粒度の作業なので、
  ユーザに手動介入を強いる代わりに既存の task turn 基盤に乗せる。これにより agent の介入は
  「通常の task turn と同じ体験」で、editor 直接編集 / chat 経由の指示 どちらでも介入できる
- **既存 session の follow-up として流す**: 新しい session / workspace は作らない。task の
  最新 session に message をキューする（`queueMessage` と同じ挙動）。これで chat 履歴が途切れず、
  conflict 解消の会話がタスクの文脈に残る
- **詰まった場合の escape hatch**: 判断に迷う hunk があれば勝手に決めず、agent がユーザに
  問い合わせて turn を終える（prompt で明示指示）。既存 UI の Abort / Continue ボタンは残して
  いるので、ユーザは手動 override も可能
- **ユーザの editor 介入は非同期に許容**: agent は worktree 内で動くので、ユーザが途中で
  editor で手直ししても agent の次ループが新しい内容を読み直す。特別なロックは掛けない
  （通常 task の編集介入と同じルール）

## シナリオ

### conflict 発生 → agent が即解消

1. `trpc.git.rebase(...)` が `{ success: false, hasConflicts: true, conflictedFiles: [...] }` を返す
2. client が続けて `trpc.git.resolveRebaseConflict({ workspaceId, projectId })` を呼ぶ
3. usecase は task の最新 session を取得 → conflict 解消 prompt を組み立て → `messageQueue.queue`
4. session の agent が idle で待機中なら既存 process にそのまま `sendMessage`、そうでなければ
   `startProtocol` で新 process を起動（`resumeSessionId` / `resumeMessageId` で Claude Code
   の会話を継続）
5. agent が marker を読み、編集し、`git add <file>` → `git rebase --continue` を実行
6. 必要なら手順を繰り返し、rebase が clean に終わるまで進める
7. 完了後は通常通り turn が終わる。`useBranchStatus` の 5s poll で UI 側も更新される

### agent が解消不能と判断した場合

1. 上記 5 の途中で、agent が「この hunk は自動で判断してよいか分からない」と判定
2. 最後の user-visible メッセージで、conflict の状況と可能な選択肢を書いて turn を終える
3. UI 側は chat panel にその最終メッセージが表示される（既存 UI のまま、特別扱いなし）
4. ユーザは chat で follow-up を返すか、手で編集してから `continueRebase` / `abortRebase` を呼ぶ

### ユーザが途中で手動介入

1. agent が作業中でも、ユーザはいつでも editor で該当ファイルを編集できる
2. agent の次ループで新しい内容が読まれて整合が取れる
3. 強制的に止めたい場合は UI の `Abort` ボタンで `git rebase --abort`、
   もしくは chat で stop を指示

## 失敗 / 例外

- `NOT_FOUND` — workspace / project / worktree が見つからない
- `INVALID_STATE` — rebase が進行中でない、conflicted files が無い、session が存在しない
  （通常 UI からは発火しないが、競合状態の二重呼び出し等を弾く）
- agent 実行中の Executor 呼び出しエラー → `INTERNAL`（通常の executor 失敗と同じ扱い）
