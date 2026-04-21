---
id: "01KPNX4PA8CV9HVRA6SADJ0WSZ"
name: "coding_agent_process_is_one_executor_invocation"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/models/coding-agent-process/index.ts`
- `server/schema/tables/coding_agent_processes.sql`
- `server/src/repositories/executor/` (実際の spawn)
- `server/src/repositories/coding-agent-process/`

## 機能概要

**CodingAgentProcess は、1 回 Executor サブプロセスを spawn した実行ライフサイクルを表す
エンティティ**である。状態は `running / completed / failed / killed / awaiting_approval` の 5 種。
Session : Process = 1:N で、同じ Session 内で何本でも Process が生まれうる。

## 設計意図

### なぜ Process を DB エンティティにしたか

プロセスは揮発する（死ねば消える）ものだが、**AutoKanban は死んだプロセスも追跡したい**:

- UI のタスク詳細で「さっき実行したやつ、exit code いくつで死んだ？」を見せたい
- ログを後から取り戻せるように、`processId` と 1:1 で紐づく永続ログが必要
- resume の起点として、どの process が生きていてどれが死んでいるかを記録したい

よって Process を DB に載せ、プロセスが生まれる度にレコードを 1 つ作る。
プロセスが死ぬと `on-process-complete` callback で status と `completedAt` / `exitCode` を更新する。

### なぜ `awaiting_approval` を独立ステータスにしたか

通常の「実行中 / 終了」の 2 軸では捉えきれない状態がある:

- プロセスは生きている（kill されていない）
- しかし Claude Code はツール使用許可待ちで止まっている
- ユーザーの応答を待っている

これは `running` でも `completed` でもなく、**承認待ちという論理的に別の状態**。
Task が `inreview` に遷移しているのと同じように、Process も対応する
`awaiting_approval` ステータスを持つ。応答後は `restoreFromApproval` で `running` に戻る。

この分離により:

- UI は「いま何本の process が承認待ちか」を簡単に集計できる
- Stop ボタンは `running` と `awaiting_approval` の両方で有効、という UI ロジックが自然に書ける
- completed / failed / killed のターミナル状態との区別が明確

### なぜ新プロセスで resume するか（プロセスを使い回さないか）

Claude Code の設計上、1 プロセスは「起動時に渡した `--resume <sessionId>` で始まる会話」
しか持てない。既に走っているプロセスに別の会話を引き継がせることはできない。
したがって「resume する = 新プロセスを起動する」のが Claude Code の仕様レベルの制約。

AutoKanban はこれを受け入れ、Resume や Fork のたびに新 CodingAgentProcess を作る。
前 Process は `killed` / `completed` として残り、履歴として参照可能。

## 主要メンバー

- `id / sessionId`
- `status: "running" | "completed" | "failed" | "killed" | "awaiting_approval"`
- `exitCode: number | null`
- `startedAt / completedAt: Date | null`
- `createdAt / updatedAt`
- メソッド: `complete(process, status, exitCode)` — ターミナル状態への遷移
- メソッド: `toAwaitingApproval / restoreFromApproval`

## 関連する動作

- 起動: [execution_is_started_for_task](./execution_is_started_for_task.md)
- 停止: [execution_is_stopped_by_user](./execution_is_stopped_by_user.md)
- 終了通知: [process_completion_updates_task_status](../callback/process_completion_updates_task_status.md)
- idle 通知: [process_idle_triggers_next_queued_message](../callback/process_idle_triggers_next_queued_message.md)
- 承認待ち遷移: [approval_request_is_detected_and_persisted](../callback/approval_request_is_detected_and_persisted.md)
