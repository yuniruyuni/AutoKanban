---
id: "01KPNSJ3RRYH45YHGMS83W76H0"
name: "dev_server_lifecycle_is_managed"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/usecases/dev-server/start-dev-server.ts`
- `server/src/usecases/dev-server/stop-dev-server.ts`
- `server/src/usecases/dev-server/get-dev-server.ts`
- `server/src/presentation/trpc/routers/dev-server.ts`
- `server/src/models/dev-server-process/index.ts`
- `server/src/repositories/dev-server/`
- `server/src/repositories/dev-server-process-logs/`
- `server/src/repositories/workspace-config/` (`auto-kanban.json` の `server` キー)

## 機能概要

`auto-kanban.json` の `server` スクリプト（例: `bun run start:dev`）をタスクの worktree 上で起動、
停止、状態取得する API 群。同一 session 内では 1 プロセスのみ running を許容し、
重複起動要求は既存の `executionProcessId` を返して no-op。

## 概念的背景: なぜタスク単位の Dev Server を作ったか

AI コーディングエージェントに「フロントエンドの色を変えて」と頼んだとき、ユーザーが
次に知りたいのは「**で、実際どう見えるの？**」である。ここで選択肢は:

1. ユーザーが自分のメインチェックアウトで `npm run dev` を起動してブラウザで見る
2. AI の worktree に `cd` して `npm run dev` を別途起動し、別 port で見る
3. AutoKanban が AI の worktree 上で dev server を起動してくれる

1 は「AI のブランチを main にマージしてから見る」という順序になり、試行錯誤のテンポが悪い。
2 は毎回ターミナルを開いて手で叩くのが面倒で、プロセスの後始末も忘れがち。

AutoKanban は 3 を選んだ: **タスクごとに worktree 上で dev server を立ち上げ、
停止・再起動・ログ閲覧を UI から行える**。これにより
「AI にお願い → ちょっと待つ → dev server で動作確認 → OK なら done、ダメなら follow-up」
のサイクルがカンバン内で閉じる。

port 衝突は解決しない: ユーザーの責任で別 port を割り当てるか、タスクを 1 個ずつ順番に
確認することを前提とする（通常、並行実行は 2-3 タスク程度なので現実的）。

`DevServerProcess` エンティティを `CodingAgentProcess` と別に切ったのは、
**同じ process だが役割が全く違う**ため。ライフサイクル（長命）、制御（Start/Stop のみ）、
ログ配信先（独立 SSE）すべて異なり、同じテーブルに混ぜると条件分岐が爆発する。

## 設計意図

dev server はタスクごとに worktree 上で独立起動できる（port conflict はユーザーが解決）。
これにより AI が書いたコードを手動で動作確認する流れが **カンバン内で完結**する。

**`auto-kanban.json` に `server` が無いプロジェクトは dev server 機能を使えない**
（`INVALID_STATE`）。これは設計上の割り切りで、「dev server を持たないプロジェクト
（ライブラリなど）で UI に dev server ボタンを押せるようにする必要はない」という判断。
代わりに task-template の `condition: "no_dev_server"` でそういうプロジェクト向けには
dev server 関連のテンプレートタスクを出さない、という連携もしている。

## シナリオ

### 起動（初回）

1. ユーザーが `trpc.devServer.start({ taskId })`
2. `read` で task / project / active workspace / latest session を取得、既存 running を確認
3. 既存 running があればそれを返す（alreadyRunning）
4. なければ `DevServerProcess.create`、post で `workspaceConfig.load` → `config.server` を `devServer.start` に渡す
5. finish で DevServerProcess を upsert
6. `{ executionProcessId }` を返却

### 停止

1. `trpc.devServer.stop({ executionProcessId })`
2. `devServer.stop(processId)` が SIGTERM → SIGKILL を送る
3. `on-process-complete` callback が status を更新

### state とログ取得

1. `trpc.devServer.get({ taskId })` で現在のプロセスと port、直近ログを返す
2. UI は「dev server running http://localhost:3000 / 最終ログ 10 行」を表示

## 失敗 / 例外

- `NOT_FOUND` — task / project / workspace / session のいずれかがない
- `INVALID_STATE` — `auto-kanban.json` に `server` キーがない、または worktree パス未設定
