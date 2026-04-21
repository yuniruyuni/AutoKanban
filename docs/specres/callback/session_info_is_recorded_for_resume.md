---
id: "01KPNSJ3QYE2ZFFYFFQ19JD3AH"
name: "session_info_is_recorded_for_resume"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/usecases/execution/on-session-info.ts` (`updateSessionInfo`)
- `server/src/presentation/callback/routers/on-session-info.ts`
- `server/src/models/coding-agent-turn/index.ts` (`updateAgentSessionId`, `updateAgentMessageId`)

## 機能概要

Claude Code プロセスが初期化中に発行する `session_id` / `message_id` を受け取り、
対応する `CodingAgentTurn` レコードに記録する。これにより後から `--resume <sessionId>` /
`--resume-session-at <messageId>` でプロセスを再開できるようになる。

## 設計意図

`CodingAgentTurn` は 1 プロセス 1 レコード、ここに `agentSessionId` と `agentMessageId` を
累積的に書き込む。必要になるのは:
- 次の follow-up を送るときの resume 経路
- `forkConversation` による分岐
- `killed` 状態からの resume

## シナリオ

### Initial session id arrives

1. Executor 起動直後に `/callback/on-session-info` が POST される（`processId`, `agentSessionId`）
2. `updateSessionInfo({ processId, agentSessionId, agentMessageId: null })`
3. `codingAgentTurn.updateAgentSessionId(processId, agentSessionId)` で DB 更新

### Message id arrives

1. 会話の進行に伴って `agentMessageId` が更新される
2. `updateSessionInfo({ processId, agentSessionId: null, agentMessageId })`
3. `codingAgentTurn.updateAgentMessageId(...)` で DB 更新

### Both present

1. 両方一度に渡された場合は両方とも更新

## 失敗 / 例外

- 対応する CodingAgentTurn が存在しなければ Repository 側でサイレントに no-op
