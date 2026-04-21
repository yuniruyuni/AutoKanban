---
id: "01KPNSJ3RA08KSRZFYJ61HG2AB"
name: "log_stream_is_subscribed_via_sse"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/presentation/sse/routers/log-stream.ts` (`logStreamRoute`)
- `server/src/usecases/execution/get-log-stream-delta.ts` (`getLogStreamSnapshot`, `getLogStreamDelta`)
- `server/src/presentation/sse/stream.ts` (`sseRoute`)
- `server/src/repositories/log-store/`
- `client/src/lib/sse.ts`

## 機能概要

`/sse/logs/:executionProcessId` エンドポイントで Coding Agent のログを SSE 購読する。
初回接続時は全ログの snapshot を、以降は最後の `offset` からの delta（差分）を
200ms 間隔で配信する。クライアント側は文字列を連結してビューに表示する。

## 概念的背景: Snapshot + Delta モデルを採用した理由

AutoKanban が agent ログ配信で解きたい問題は 3 つある:

1. **再訪時の履歴復元**: カンバンから別タスクを開いて戻ってきたとき、過去の agent 対話を
   最初から見直したい
2. **リアルタイム追従**: agent が今しゃべっている内容を秒単位で UI に反映したい
3. **接続断の頑健性**: ノート PC のスリープ、Wi-Fi 切断などで SSE が切れても、
   再接続で同じ状態に復帰したい

この 3 要件に対して、以下の選択肢がある:

- **WebSocket**: 双方向だが Hono + SSE よりも実装が重く、AutoKanban はそもそも
  サーバー→クライアントの一方向しか要らない
- **ロングポーリング**: サーバー負荷は小さいが latency が秒単位になり要件 2 を満たせない
- **SSE + snapshot + delta**: SSE の単純な 1 方向接続で、初回に全量を配信、
  以降は差分だけを送る。`state` にオフセットを持たせることで接続断後も続きから配信できる

AutoKanban は 3 番目を採用した。**状態はクライアントではなくイベント stream の `state` に持たせる**
点が肝で、サーバー側にセッション状態を貯める必要がない（stateless 指向）。

## 設計意図

「snapshot + delta」モデルは:
- 初回ロードで過去ログを全取得できる（履歴復元）
- 接続断・再接続があっても `state.offset` から続けられる（冪等）
- ロングポーリングや WebSocket より実装が軽い

`getLogStreamDelta` は**純粋関数的に動き**（read ステップで DB を読み、process ステップで
delta を返すだけ）、サーバー側の状態は `state` を介して client に返る
（`sseRoute` のフレームワークが state 往復を管理）。**200 ms 間隔**は UI 更新の体感と
サーバー負荷のバランスで選ばれた値で、体感上は「リアルタイム」に感じる最下限。

## シナリオ

### 初回購読（snapshot）

1. クライアントが `GET /sse/logs/<processId>` を open
2. `sseRoute` が `getLogStreamSnapshot(params)` を呼ぶ
3. `codingAgentProcessLogs.getLogs(processId)` で全ログ取得
4. `{ events: [{ type: "log", data: content }], state: { offset: content.length } }` を送信

### 継続的な delta

1. 200ms ごとに `getLogStreamDelta(params, state)` を呼ぶ
2. 新しいログがあれば `content.slice(state.offset)` を返し、state を更新
3. 変更なしなら `events: []` を返す

## 失敗 / 例外

- `processId` に対応するログが存在しない場合、空の snapshot を返す（fail しない）
- SSE 接続自体の切断はクライアント側で retry
