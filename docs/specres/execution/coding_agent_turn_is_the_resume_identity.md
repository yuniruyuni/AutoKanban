---
id: "01KPNX4PAAXA6FR10PJY9C1DF1"
name: "coding_agent_turn_is_the_resume_identity"
status: "draft"
---

## 関連ファイル

- `server/src/models/coding-agent-turn/index.ts`
- `server/src/models/coding-agent-turn/resume-info.ts`
- `server/schema/tables/coding_agent_turns.sql`
- `server/src/repositories/coding-agent-turn/`

## 機能概要

**CodingAgentTurn は、1 つの CodingAgentProcess に対する Claude Code 側の会話 ID を
保持するエンティティ**である。`agentSessionId` / `agentMessageId` / 初回 `prompt` / `summary` を持ち、
Claude Code の `--resume <sessionId>` / `--resume-session-at <messageId>` に直接渡される。
CodingAgentProcess : CodingAgentTurn = 1:1。

## 設計意図

### なぜ Process と Turn を分けたか

AutoKanban 側の Process 管理と、Claude Code 側の会話識別子管理は**関心が違う**:

- Process は「サブプロセスのライフサイクル」（pid, exit code, startedAt）
- Turn は「Claude Code 側の会話とメッセージ位置」（agentSessionId, agentMessageId, summary）

両者を同じテーブルに混ぜると、プロセス状態と会話識別子のライフタイムが食い違ったときに
混乱する。分離することで、プロセスが死んでも Turn は残り、次の Process から resume に使える、
という関係が自然に表現できる。

### `agentSessionId` と `agentMessageId` の意味

- `agentSessionId`: Claude Code の **会話全体の ID**。`--resume <sessionId>` の引数。
  会話をまるごと引き継ぐときに必要
- `agentMessageId`: 会話の中の**特定メッセージ位置**の ID。`--resume-session-at <messageId>` の引数。
  「この位置から分岐したい」（fork）ときに必要

この 2 つを **Turn レコードに保存し続ける**ことで:

- プロセスが死んだ後でも resume 可能（AutoKanban 再起動後も含む）
- 会話の過去の任意時点から fork 可能
- どの Process が同じ会話の続きか、というトレースが可能

### なぜ初回 `prompt` も保存するか

初回 prompt は `taskToPrompt(task)` で task から再生成できるが、**execution 時点のスナップショット**を
保持することで「あの実行はどういう指示で動いたか」を履歴から再現できる。task の description を
後で変更しても、Turn の `prompt` は当時のまま残る。

### `summary` フィールド

Claude Code はターン終了時に short summary を自動生成する（`on-summary` callback で届く）。
これを Turn に保存することで:

- AttemptSwitcher で「この attempt は何をやったか」が 1 行で見える
- カンバンカードの補助情報として表示できる
- 会話ログ全文を読まなくてもおおよその内容が分かる

LLM 生成テキストなので正確性に限界はあるが、インデックスとして十分機能する。

## 主要メンバー

- `id / executionProcessId` — 親 Process との 1:1 紐付け
- `agentSessionId: string | null` — Claude Code の session ID
- `agentMessageId: string | null` — 最新メッセージ ID
- `prompt: string` — 初回 prompt のスナップショット
- `summary: string | null` — Claude 生成のターン要約
- `seen: boolean` — UI での既読フラグ
- `createdAt / updatedAt`

## 関連する動作

- 作成: [execution_is_started_for_task](./execution_is_started_for_task.md) / follow-up 時
- 更新: [session_info_is_recorded_for_resume](../callback/session_info_is_recorded_for_resume.md)
  / [summary_is_recorded_on_turn_end](../callback/summary_is_recorded_on_turn_end.md)
- 使用: [execution_resumes_from_killed_session](./execution_resumes_from_killed_session.md)
  / [conversation_is_forked_at_message](./conversation_is_forked_at_message.md)
