---
id: "01KPNSJ3QH0F7EGESDD7AV06F6"
name: "follow_up_message_is_sent_or_queued"
status: "draft"
---

## 関連ファイル

- `server/src/usecases/execution/queue-message.ts` (`queueMessage`)
- `server/src/usecases/execution/queue-message.test.ts` (Test)
- `server/src/presentation/trpc/routers/execution.ts` (`queueMessage` procedure)
- `server/src/models/message-queue/index.ts`
- `server/src/repositories/message-queue/`
- `server/src/repositories/executor/`
- `client/src/components/chat/FollowUpInput.tsx`

## 機能概要

Coding Agent 実行中に追加メッセージを送る（または次の send までキューに入れる）。
- `running + idle`: 既存プロセスに `executor.sendMessage` で即時送信
- `running + not idle`: message-queue に追加（`on-process-idle` コールバックが次のドレインをトリガー）
- `not running`: 新プロセスを resume 付きで起動して送る

## 概念的背景: なぜ Message Queue が要るか

Coding Agent のインタラクションは、**ユーザーが打ち込むタイミング**と
**Agent が入力を受け取れるタイミング**が一致しない。具体的には:

- Agent が長いタスクを実行中（ツール使用の連鎖）は、stdin を見ていない。ここに無理やり
  入力を投げると、Claude Code は受け取るが「次のターンの prompt」として混線する
- Agent がちょうどターン終了で idle に戻った瞬間は stdin を待機しているので、投げて良い
- Agent プロセスが既に死んでいる場合は、**resume 経路で新プロセスを立ち上げてから**投げないと
  そもそも受け取り手がいない

ユーザーにこれを意識させるわけにはいかない（いつ idle かなんて外から分からない）。
そこで AutoKanban は「送信要求はすべてキューに預け、受け取れる状態になったら AutoKanban 側で
自動的に消費する」というモデルを取る。キューの実体は session ごとの in-memory ストアで、
**UI からは単なる `queueMessage` 呼び出し**で済む。

## 設計意図

Claude Code の stdin は busy 中にメッセージを入れると行儀が悪くなるため、
「idle 判定 → sendMessage / それ以外は enqueue」という 2 段階の送信 / キューイングロジックを
`queueMessage` に集約している。キューのドレインは **Executor 側の idle 通知**（callback の
`on-process-idle`）を待つ。

**なぜ idle 判定を logs のパース結果から取るか**: Claude Code は control protocol で
「今 idle です」を直接通知してくれるわけではなく、会話ログの最終 event 形から推論するしかない。
`parseLogsToConversation(logs).isIdle` がその推論ロジックを一箇所に集約している。

**なぜキューを DB に入れないか**: follow-up は「秒単位で消費される揮発的な指示」であり、
DB に書いて読んで消すオーバーヘッドに見合わない。再起動時に失われて困るメッセージは
そもそもユーザーがまだ操作中の瞬間のものなので、UI で立て直してもらう方が自然。

## 主要メンバー

- `sessionId: string`
- `prompt: string`
- `executor?` / `variant?` — 新プロセス起動時に使用

## シナリオ

### Immediate send (running + idle)

1. `trpc.execution.queueMessage({ sessionId, prompt })`
2. `read` で latestProcess が `running`、logs の parse で `isIdle: true`
3. `post` で `messageQueue.queue` してすぐ `consume`、`executor.sendMessage` を呼ぶ
4. `logStoreManager.get(processId).append(stdin log)` でメモリに追記
5. `finish` で `coding_agent_process_logs` に `[stdin]` 行を永続化

### Queue only (running + busy)

1. latestProcess は `running` だが `isIdle: false`
2. `messageQueue.queue(...)` のみ実行
3. `{ queuedMessage, sentImmediately: false }` を返却
4. Executor が idle になったら `on-process-idle` callback がキューをドレインする

### Resume after killed (not running + resumeInfo)

1. latestProcess が `killed` / `completed`、かつ resumeInfo がある
2. `process` で新 CodingAgentProcess と CodingAgentTurn を作成
3. `post` で `executor.startProtocol({ resumeSessionId, interruptedTools, prompt: queuedMessage.prompt })`
4. `finish` で新プロセスと turn を upsert、stdin log を書く

## 失敗 / 例外

- `NOT_FOUND` — session / workspace が存在しない
- 新プロセス起動時に `workingDir` が解決できない → キューに戻して sentImmediately: false
- `executor.sendMessage` が false を返した場合は fallback で新プロセス起動を試みる
