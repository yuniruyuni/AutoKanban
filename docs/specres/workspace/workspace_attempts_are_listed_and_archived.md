---
id: "01KPNSJ3QEEC6KYB370PM3CRT8"
name: "workspace_attempts_are_listed_and_archived"
status: "draft"
---

## 関連ファイル

- `server/src/usecases/workspace/list-attempts.ts`
- `server/src/usecases/workspace/list-attempts.test.ts` (Test)
- `server/src/usecases/workspace/get-attempt-execution.ts`
- `server/src/usecases/workspace/get-attempt-execution.test.ts` (Test)
- `server/src/usecases/workspace/find-workspace-by-path.ts`
- `server/src/presentation/trpc/routers/workspace.ts`
- `client/src/components/chat/AttemptSwitcher.tsx`

## 機能概要

タスクに紐づく attempt 一覧を返す（`listAttempts`）。
各 attempt は `{ workspaceId, attempt, branch, archived, sessionId, latestStatus, createdAt }` を持ち、
UI の AttemptSwitcher で履歴を切り替えられるようにする。
`getAttemptExecution` は単一 workspace の最新 session / coding agent process ID を返す。
`findWorkspaceByPath` は worktree パスから逆引きして `{ workspace, task, project }` を返す
（MCP サーバー経由で外部 agent が自分のいる場所を問い合わせるのに使う）。

## シナリオ

### List attempts for UI

1. `trpc.workspace.listAttempts({ taskId })`
2. `read` で全 workspace を `createdAt asc` で取り、各 workspace について最新 session と
   最新 coding agent process を参照して status を集約
3. `activeAttempt` は `archived !== true` の workspace の `attempt`（最大 1 件）
4. UI は `attempts[]` を古い順に並べて表示、`activeAttempt` を強調

### Get execution for attempt

1. `trpc.workspace.getAttemptExecution({ workspaceId })`
2. 最新 session → 最新 coding agent process の ID を返す
3. session がなければ `sessionId: null, executionProcessId: null`

### Find workspace by path (MCP)

1. MCP ツール経由で worktree パスから問い合わせ
2. `Workspace.findByWorktreePath` → Task → Project を辿って返す
3. どこかで NOT_FOUND が出たら対応する fail を返す

## 失敗 / 例外

- `NOT_FOUND` — `findWorkspaceByPath` で workspace / task / project のいずれかが無い
