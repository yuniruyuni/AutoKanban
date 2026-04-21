---
id: "01KPNSJ3QT901FC4PHSRS0SPKV"
name: "execution_or_latest_is_fetched"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/usecases/execution/get-execution.ts`
- `server/src/usecases/execution/get-execution.test.ts` (Test)
- `server/src/usecases/execution/get-latest-execution.ts`
- `server/src/usecases/execution/get-latest-execution.test.ts` (Test)
- `server/src/presentation/trpc/routers/execution.ts` (`get`, `getLatest` procedures)

## 機能概要

2 種類の取得経路:
- **`getExecution({ executionProcessId })`**: 具体的な `processId` から `CodingAgentProcess` /
  `DevServerProcess` / `WorkspaceScriptProcess` のどれかを判別して返す
- **`getLatestExecution({ taskId })`**: `Task → Workspace(active) → latest Session → latest CodingAgentProcess`
  のチェーンを辿り、最も新しい coding agent プロセスを返す

`includeLogs: true` を指定すると `coding_agent_process_logs` も同梱する（getExecution のみ、
CodingAgentProcess 時）。

## 設計意図

`getExecution` は汎用的な参照（チャット画面の再訪、タスク詳細パネル）、
`getLatestExecution` はタスクを開いた瞬間に「今どこまで進んでる？」を即答するための早見窓口。
どちらも `read` ステップのみで完結（副作用なし）。

## シナリオ

### Get by process id (coding agent)

1. `trpc.execution.get({ executionProcessId, includeLogs: true })`
2. `read` で `CodingAgentProcess.ById` を順に試す → 見つかればそれを返す、logs も同梱
3. `{ executionProcess, logs }` を返却

### Get by process id (dev server or script)

1. CodingAgentProcess で見つからなければ DevServerProcess → WorkspaceScriptProcess の順に試す
2. どこかで見つかればそれを返す（logs は含まない）
3. どこでも見つからなければ `fail("NOT_FOUND")`

### Get latest execution for task

1. `trpc.execution.getLatest({ taskId })`
2. `Workspace.ByTaskIdActive(taskId)` で現在 active の workspace を取得
3. 最新 session と最新 CodingAgentProcess を辿る
4. 途中のどこかが空なら対応する field は `null`、それ以降は走査しない

## 失敗 / 例外

- `NOT_FOUND` — `getExecution` で processId が全種類に対してミスヒット
