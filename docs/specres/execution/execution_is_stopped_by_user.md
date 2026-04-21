---
id: "01KPNSJ3QMPBNZVNKVC97HZB52"
name: "execution_is_stopped_by_user"
status: "draft"
---

## 関連ファイル

- `server/src/usecases/execution/stop-execution.ts`
- `server/src/usecases/execution/stop-execution.test.ts` (Test)
- `server/src/presentation/trpc/routers/execution.ts` (`stop` procedure)
- `server/src/repositories/executor/` (`stop`)

## 機能概要

ユーザーが実行中（または承認待ち）の Coding Agent プロセスを停止する。
`executor.stop(processId)` が SIGKILL (またはドライバ固有の停止処理) を送る。
DB 上のステータス更新は `on-process-complete` callback 経由で後から行われる。

## シナリオ

### Successful stop

1. ユーザーが「Stop Agent」ボタンを押す
2. `trpc.execution.stop({ executionProcessId })`
3. `read` で `CodingAgentProcess.ById` を取得、`status === "running"` または `"awaiting_approval"` を検証
4. `post` で `executor.stop(processId)` が成功すると `{ stopped: true, executionProcessId }` を返す
5. Executor が死ぬと `on-process-complete` callback が `killed` で status を更新する

### Already terminal

1. status が `completed` / `failed` / `killed` のどれかだった
2. `fail("INVALID_STATE", "Coding agent process is not active", { status })`

## 失敗 / 例外

- `NOT_FOUND` — processId に対応するプロセスがない
- `INVALID_STATE` — プロセスが active 状態でない
