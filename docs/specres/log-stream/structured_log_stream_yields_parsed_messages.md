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
- `server/src/models/agent/`
- `server/src/models/conversation/conversation-parser.ts` (`parseLogsToConversation`)
- `server/src/models/conversation/types.ts` (`ConversationEntry`)
- `client/src/components/chat/ConversationPanel.tsx`

## 機能概要

raw ログを **構造化された会話エントリ**（user メッセージ / assistant メッセージ /
tool use / tool result / text chunk など）にパースした状態で SSE 配信する。

parser は Agent ごとに異なる。`getStructuredLogs` / `getStructuredLogDelta` は
`CodingAgentProcess -> Session.executor -> AgentRepository.getParser()` の順に Agent parser を解決し、
raw log を `ConversationEntry[]` と `isIdle: boolean` に変換する。

Claude Code は既存の `parseLogsToConversation(logs)` を使い、Codex CLI は
`CodexCliLogParser` が `codex exec --json` の JSONL event を同じ `ConversationEntry` に写像する。

## 設計意図

生ログはフォーマットが壊れやすい（PTY の ANSI シーケンス、JSON の分割、stderr 混在など）ため、
ConversationPanel では構造化ストリームを優先し、Raw Logs ビューでのみ生テキストを出す。
構造化ストリームは delta エンコーディングで送るが、delta の単位は entry 単位
（`ConversationEntry` の追加 / 更新）になる。

### なぜ Agent parser を model に置くか

ログ parser は `parse(rawLogs: string) -> ParseResult` の純粋計算であり、DB や subprocess に触らない。
そのため repository や infra ではなく `models/agent` に置く。
外部 CLI の stdout/stderr を集めて DB に保存する責務は repository / infra 側にあるが、
保存済み raw log を AutoKanban の会話 read model に変換する責務は model 側の parser が持つ。

この分離により:

- usecase は executor 固有の JSON 形式を知らない
- UI は Claude / Codex / Gemini の違いを意識せず `ConversationEntry` だけを描画する
- parser は fixture 文字列で単体テストできる
- Codex CLI から Codex app-server へ移行しても、parser と driver を差し替えればよい

### 共通 read model への正規化

`ConversationEntry` は agent 共通の UI 契約である。

| raw event | 正規化先 |
|---|---|
| Claude `assistant` text | `assistant_message` |
| Claude `tool_use` / `tool_result` | `tool` |
| Claude `control_request` | `tool.status = pending_approval` |
| Codex `agent_message` | `assistant_message` |
| Codex `agent_reasoning` | `thinking` |
| Codex `exec_command_begin` / `exec_command_end` | `tool` with `command` action |
| stderr | `error` または実行中 tool の result |

未知 event は原則として無視する。raw log は別ビューで確認できるため、parser が未知 event を
無理に表示するよりも、既知 event を安定して正規化することを優先する。

## シナリオ

### スナップショット

1. `/sse/structured-logs/<processId>` を open
2. `getStructuredLogSnapshot({ executionProcessId })` が process と session を読み、Agent parser を選ぶ
3. parser が全エントリを返す
4. `{ entries: [...], isIdle: false }` を初回 event として配信

### 差分

1. 200ms ごとに `get-structured-log-delta` が呼ばれる
2. 前回と同じ Agent parser で raw log 全体を再パースする
3. `computeDelta` が前回との差分（追加エントリ、最新エントリの更新）だけを配信

### Codex CLI log

1. `CodexCliDriver` が `codex exec --json` の stdout を line 単位で callback へ流す
2. `coding_agent_process_logs` に `[timestamp] [stdout] <json-line>` として保存される
3. `CodexCliLogParser` が JSONL event を読む
4. `exec_command_begin` は running tool、`exec_command_end` は tool result に変換される
5. `agent_message` は assistant message として表示される

## 失敗 / 例外

- `NOT_FOUND` — coding agent process が存在しない
- ログが空なら `entries: []`, `isIdle: false` を返す
- 未知 Agent id は parser 解決時に internal error になる。通常は UI が catalog / variants に存在する
  executor だけを選ぶため発生しない
- 未知 log event は無視する。Raw Logs ビューでは確認可能
