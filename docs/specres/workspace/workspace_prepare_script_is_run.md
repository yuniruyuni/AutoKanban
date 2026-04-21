---
id: "01KPNSJ3QC5W9HVHPA3PGSMZRF"
name: "workspace_prepare_script_is_run"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/usecases/workspace/run-workspace-script.ts`
- `server/src/usecases/execution/start-execution.ts` (`post` 内で prepare を実行)
- `server/src/repositories/script-runner/`
- `server/src/repositories/workspace-config/`
- `server/src/models/workspace-script-process/index.ts`
- `auto-kanban.json`（各プロジェクトの worktree ルートに置かれる設定ファイル）

## 機能概要

worktree 作成直後に `auto-kanban.json` の `prepare` スクリプトを実行する。
一般的な用途は `bun install`、symlink 修復、DB シード投入など、
「worktree に切り替えた直後に走らせたい初期化」。
`run-workspace-script` ユースケースは `prepare` / `cleanup` を手動で再実行するためのエンドポイント。

## 設計意図

- 自動発火は `start-execution` の post 内に組み込まれており、agent 起動の前提として完走を要求する
- 手動再実行ルート（`trpc.execution.runPrepare`）は **同一 session で同時に他のスクリプトが動いていないこと**
  をチェックし、重複実行を防ぐ
- prepare が失敗（非 0 exit code）したら agent は起動しない（`PREPARE_SCRIPT_FAILED`）

## シナリオ

### Automatic prepare on start-execution

1. worktree 作成直後に `workspaceConfig.load(worktreePath)` で `auto-kanban.json` を読む
2. `config.prepare` があれば `scriptRunner.run({ command, workingDir })` を同期実行
3. exit code 0 なら `WorkspaceScriptProcess.complete(..., "completed", 0)` で完了を記録
4. exit code 非 0 なら `"failed"` で記録、`fail("PREPARE_SCRIPT_FAILED")`

### Manual re-run

1. ユーザーが `trpc.execution.runPrepare({ taskId })` を呼ぶ
2. active workspace / 最新 session を特定し、running なスクリプトが無いことを確認
3. `WorkspaceScriptProcess.create({ sessionId, scriptType: "prepare" })`
4. `devServer.start` 経由で非同期起動し、`executionProcessId` を返す
5. ログは dev-server と同じルートで配信される

## 失敗 / 例外

- `NOT_FOUND` — task / project / active workspace / session がない
- `INVALID_STATE` — worktree パス未設定、または他の script が既に running
- `INVALID_STATE` — `auto-kanban.json` に対応スクリプトが無い
- `PREPARE_SCRIPT_FAILED` — 自動実行で exit code 非 0（start-execution から）
