---
id: "01KPNSJ3QP8DF0PYD2E00BG91E"
name: "execution_resumes_from_killed_session"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/usecases/execution/queue-message.ts` (resume 分岐)
- `server/src/usecases/execution/start-execution.ts` (初回起動時の resume 分岐)
- `server/src/models/coding-agent-turn/index.ts` (`findLatestResumeInfo`, `findLatestResumeInfoByWorkspaceId`)
- `server/src/models/conversation/conversation-parser.ts` (`findPendingToolUses`)

## 機能概要

`killed` / `completed` 状態のプロセスで途切れた会話を、**同じセッション ID / メッセージ ID から**
Claude Code の `--resume` / `--resume-session-at` フラグで続ける。
ユーザーが follow-up メッセージを送ると `queueMessage` が自動的に resume 経路を選ぶ。
また `startExecution` の attempt 再利用時にも同じロジックが使われる。

## 概念的背景: なぜ Resume が第一級機能か

AI コーディングエージェントのプロセスは**頻繁に死ぬ**:

- 長時間実行のタイムアウト、メモリ不足、ユーザーの明示 Stop、PC スリープ、macOS のアップデート、
  執筆環境に由来する些細な原因 — 要するに何でも
- かつ、死んだことに気づくまでに数秒〜数分かかる（ユーザーがカンバンを見ていなければ気付けない）

もし resume という概念がなければ、「プロセスが死んだら会話は最初からやり直し」となり、
数十分かけた実装ステップの文脈が毎回消える。これでは AutoKanban のような
「AI エージェントを長時間走らせる」プロダクトは成立しない。

Claude Code 側は `--resume <sessionId>` / `--resume-session-at <messageId>` という
**2 レベルの再開インターフェース**を提供している:

- `--resume` — 会話の末尾から続ける（通常の再開）
- `--resume-session-at` — 過去のあるメッセージ位置から分岐（fork）

AutoKanban は `CodingAgentTurn` テーブルにこの 2 つの識別子を書き溜めておくことで、
**プロセスが死んでも会話を失わない**という本質的な性質を得ている。

## 設計意図

Coding Agent は `CodingAgentTurn` テーブルに `agentSessionId` / `agentMessageId` を残しており、
これを `executor.startProtocol({ resumeSessionId, resumeMessageId })` に渡すことで
「会話を継続する」ことができる。

**interrupted Task tool の回復**: Claude Code の会話は「assistant が tool use を投げる →
AutoKanban / 実行環境が tool result を返す → assistant が続ける」のサイクル。前プロセスが
tool result を返す前に死ぬと、resume 後の新プロセスは応答のない tool use を抱えたまま
stuck する（延々 tool response を待つ）。`findPendingToolUses` がログから途中状態の
tool use を検出し、新プロセスに **synthetic な error result** を注入する。Claude 側は
「そのツール呼び出しは失敗した」と解釈して次の行動に進める。

この補正がなければ Resume はほぼ確実に stuck するので、resume 機能と不可分の仕組み。

## シナリオ

### tool 中断付き killed からの再開

1. 前プロセスが `killed` 状態で残っている
2. ユーザーが follow-up メッセージを送る → `queueMessage`
3. `read` で `resumeInfo = findLatestResumeInfo(sessionId)` を取得、
   `interruptedTools = findPendingToolUses(logs.logs)`
4. `post` で `executor.startProtocol({ resumeSessionId, resumeMessageId, interruptedTools })` を呼ぶ
5. 新プロセスが resume で立ち上がり、synthetic error 注入後に follow-up prompt を処理

### resume 情報が無い

1. `findLatestResumeInfo` が `null`
2. `queueMessage` は通常の新規起動経路（resume なし）で続ける
3. Claude Code は新しい会話として扱う

## 失敗 / 例外

- resume 前提で fork を試みた場合、`agentSessionId` が無ければ `INVALID_STATE`（`forkConversation`）
- Executor 側で resume 失敗時は通常の起動失敗と同じ扱い
