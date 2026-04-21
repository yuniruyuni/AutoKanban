---
id: "01KPNSJ3QW3FQPJ7535FCQAXY7"
name: "process_idle_triggers_next_queued_message"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/usecases/execution/on-process-idle.ts`
- `server/src/presentation/callback/routers/on-process-idle.ts`
- `server/src/repositories/message-queue/`
- `server/src/models/task/index.ts` (`Task.toInReview`)

## 機能概要

Coding Agent が「ユーザー入力待ち（idle）」に入ったタイミングで Executor が発火するコールバック。
キューに follow-up メッセージがあればそれを即座に `executor.sendMessage` で送る。
キューが空ならターンは完了したとみなし、タスクを `inreview` に遷移させる。

## 設計意図

これは **自動ドレイン経路**。`queueMessage` で `running + not idle` の状態でキューに入れられた
メッセージは、このコールバックによって send される。失敗時は再度キューに戻して次の idle を待つ。

ターン完了時に `inreview` に落とすのは、「ユーザーの確認待ち」を可視化する UX 要件。
明示的な approval request がなくても「AI が一区切り付けた」段階でレビュー促しをする。

## シナリオ

### idle 時のキュー drain

1. Executor が HTTP `/callback/on-process-idle` を POST（`processId`, `sessionId`）
2. `handleProcessIdle({ processId, sessionId })` の post で `messageQueue.consume(sessionId)`
3. queuedMessage があれば `executor.sendMessage(processId, prompt)`
4. 送信失敗なら再キューイング、成功なら return

### task を inreview に遷移（キュー無し）

1. queuedMessage が `null`
2. task を `Task.toInReview` で変換
3. finish で task を upsert（別トランザクション）
4. カンバン上で inreview に移動する

## 失敗 / 例外

- session / workspace / task が見つからない場合は `task: null`、inreview 遷移は起きない（no-op）
- `sendMessage` が false を返したら enqueue し直して次の idle を待つ
