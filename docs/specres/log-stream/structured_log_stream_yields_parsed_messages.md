---
id: "01KPNSJ3RNADFZ6C4H1H2VF44S"
name: "structured_log_stream_yields_parsed_messages"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/presentation/sse/routers/structured-log-stream.ts`
- `server/src/usecases/execution/get-structured-logs.ts`
- `server/src/usecases/execution/get-structured-log-delta.ts`
- `server/src/models/conversation/conversation-parser.ts` (`parseLogsToConversation`)
- `server/src/models/conversation/types.ts` (`ConversationEntry`)
- `client/src/components/chat/ConversationPanel.tsx`

## 機能概要

raw ログを **構造化された会話エントリ**（user メッセージ / assistant メッセージ /
tool use / tool result / text chunk など）にパースした状態で SSE 配信する。
`parseLogsToConversation(logs)` が `[timestamp] [source] <json>` 行を読み、
`ConversationEntry[]` と `isIdle: boolean` を返す。`isIdle` は Claude が user 入力を待っている状態を示し、
`queueMessage` / `on-process-idle` の判定に使う。

## 設計意図

生ログはフォーマットが壊れやすい（PTY の ANSI シーケンス、JSON の分割、stderr 混在など）ため、
ConversationPanel では構造化ストリームを優先し、Raw Logs ビューでのみ生テキストを出す。
構造化ストリームは delta エンコーディングで送るが、delta の単位は entry 単位
（`ConversationEntry` の追加 / 更新）になる。

## シナリオ

### Snapshot

1. `/sse/structured-logs/<processId>` を open
2. `getStructuredLogs({ executionProcessId })` が全エントリを返す
3. `{ entries: [...], isIdle: false }` を初回 event として配信

### Delta

1. 200ms ごとに `get-structured-log-delta` が呼ばれる
2. 前回との差分（追加エントリ、最新エントリの更新）だけを配信

## 失敗 / 例外

- `NOT_FOUND` — coding agent process が存在しない
- ログが空なら `entries: []`, `isIdle: false` を返す
