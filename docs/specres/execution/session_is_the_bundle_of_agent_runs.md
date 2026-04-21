---
id: "01KPNX4PA7ZMF3SQC17QXMF7PC"
name: "session_is_the_bundle_of_agent_runs"
status: "draft"
---

## 関連ファイル

- `server/src/models/session/index.ts`
- `server/schema/tables/sessions.sql`
- `server/src/repositories/session/`

## 機能概要

**Session は、Workspace 内での「Coding Agent 実行の 1 回のまとまり」を表すエンティティ**である。
`executor`（例: `claude-code`, `gemini`）と `variant`（起動プリセット）を保持し、
複数の `CodingAgentProcess` を束ねる。Workspace : Session = 1:N、
Session : CodingAgentProcess = 1:N の階層。

## 設計意図

### なぜ Workspace と Process の間に Session を挟むか

当初は「Workspace 直下に CodingAgentProcess を並べる」で済むように見える。しかし実際の
AI エージェント運用では、**同じ物理環境（worktree）でも「実行単位」を切りたい瞬間**が頻繁にある:

- エージェントを Stop → Resume でプロセスが 2 本に分かれる（が同じ会話の続き）
- Executor を途中で切り替える（Claude Code → Gemini で同じタスクを試す）
- fork で会話の途中から分岐する（新プロセスが生まれるが親の文脈は残る）

これらを**同じ「まとまり」として扱う**単位が必要で、それが Session。
Workspace は不変な物理環境、Process は揮発する実プロセス、Session はその中間の
「実行意図のまとまり」という 3 段階。

### executor / variant を Session が持つ理由

「今回の実行はどの AI を、どのモードで走らせるか」は **Session 単位で決まる**:

- Session 内の全 Process は同じ executor / variant で起動される（途中で変わらない）
- Session を切り直せば executor / variant を切り替えられる

この設計により「同じ worktree で、Claude Code の plan モードと default モードを両方試す」
といったことが **Session を 2 つ作る**形で自然に表現できる。

### CodingAgentProcess と分離する理由

Process はプロセスそのもの（pid, exit code, startedAt, completedAt）で、Session より短命。
「プロセスが死んで resume で立ち上げ直す」のは頻繁に起きるため、Process を Session の子に
することで、**Process の入れ替わりが Session 単位の論理を壊さない**ように分離してある。

## 主要メンバー

- `id / workspaceId`
- `executor: string` — 例: `"claude-code"`, `"gemini"`
- `variant: string | null` — Variant 名（例: `"default"`, `"plan"`）
- `createdAt / updatedAt`

## 関連する動作

- 作成: [execution_is_started_for_task](./execution_is_started_for_task.md) — Session の新規作成ポイント
- 関連: [coding_agent_process_is_one_executor_invocation](./coding_agent_process_is_one_executor_invocation.md)
- 関連: [coding_agent_turn_is_the_resume_identity](./coding_agent_turn_is_the_resume_identity.md)
- メッセージ送信: [follow_up_message_is_sent_or_queued](./follow_up_message_is_sent_or_queued.md)
- Fork: [conversation_is_forked_at_message](./conversation_is_forked_at_message.md)
