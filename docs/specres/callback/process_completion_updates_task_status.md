---
id: "01KPNSJ3QVDJYEG9E5GBS6DDN2"
name: "process_completion_updates_task_status"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/usecases/execution/on-process-complete.ts` (`completeExecutionProcess`, `processQueuedFollowUp`, `moveTaskToInReview`)
- `server/src/usecases/execution/on-process-complete.test.ts` (Test)
- `server/src/presentation/callback/routers/on-process-complete.ts`
- `server/src/presentation/callback/routers/on-process-complete.test.ts` (Test)
- `server/src/models/coding-agent-process/index.ts` (`CodingAgentProcess.complete`)

## 機能概要

Executor サブプロセスが終了したときに発火する Server 側コールバック。
- `codingagent` / `devserver` / `workspacescript` の `processType` によって対応する Model の
  `complete(entity, status, exitCode)` を呼び、status を `completed` / `failed` / `killed` に更新
- `log-store` のメモリストアを close
- 必要なら queue に残った follow-up メッセージを processQueuedFollowUp で処理（resume 起動）
- 会話のターンが完了していて次のメッセージも無ければ `moveTaskToInReview` で task を `inreview` に

## 設計意図

Executor 側から HTTP callback を受けることで、Server は `child_process.on("exit")` を直接扱わずに
済む（protocol 的に分離）。`processQueuedFollowUp` が完了直後のキュードレイン経路であり、
「前回のプロセスが死んでも自動で続き」を実現する。

## シナリオ

### 正常完了（coding agent）

1. Executor が exit code 0 で終了、HTTP `/callback/on-process-complete` を POST
2. Router が `completeExecutionProcess({ processId, sessionId, processType: "codingagent", status: "completed", exitCode: 0 })`
   を呼ぶ
3. read で既存 `CodingAgentProcess` を取得、process で `CodingAgentProcess.complete(..., "completed", 0)`
4. write で upsert、post で `logStoreManager.close(processId)`
5. router が続けて `processQueuedFollowUp({ sessionId, prompt })`（キューに残ってる場合）か
   `moveTaskToInReview({ sessionId })`（ターン完了 & キュー空）を呼ぶ

### killed プロセス

1. `status: "killed"` で callback
2. process 更新 + logStore close
3. キューに follow-up がある場合でも resume 経路で続きが起動される

## 失敗 / 例外

- 対象 process が DB に見つからなかった場合は `completed: null` で write を no-op（silent skip）
- Executor → Server の callback 送信失敗時は Executor 側のリトライに依存
