---
id: "01KPNSJ3QJN5VFJ21ZRYGPQPCF"
name: "queued_message_is_cancelled"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/usecases/execution/queue-message.ts` (`cancelQueue`, `getQueueStatus`)
- `server/src/presentation/trpc/routers/execution.ts` (`cancelQueue`, `getQueueStatus`)
- `server/src/models/message-queue/index.ts`
- `server/src/repositories/message-queue/`
- `client/src/components/chat/QueuedMessage.tsx`

## 機能概要

キューに入ったまだ送信前のメッセージを取り消す。キューは session 単位で管理される
in-memory ストアで、取り消すとメッセージそのものが削除される（送信履歴には残らない）。

## シナリオ

### キュー中メッセージのキャンセル

1. ユーザーが QueuedMessage の × ボタンを押す
2. `trpc.execution.cancelQueue({ sessionId })`
3. `read` で session 存在確認
4. `post` で `messageQueue.cancel(sessionId)` → 内部のキューから削除
5. `{ cancelled: true }` を返却（キューが空なら `false`）

### キュー状態確認

1. `trpc.execution.getQueueStatus({ sessionId })`
2. `messageQueue.getStatus(sessionId)` で現在のメッセージ数 / 先頭メッセージを返す
3. UI がポーリングで状態を表示（キュー UI の生存確認用）

## 失敗 / 例外

- `NOT_FOUND` — session が存在しない
