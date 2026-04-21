---
id: "01KPNX4PAMNEDDBVS0883HYRCG"
name: "dev_server_process_is_a_worktree_scoped_server"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/models/dev-server-process/index.ts`
- `server/schema/tables/dev_server_processes.sql`
- `server/src/repositories/dev-server/`
- `server/src/repositories/dev-server-process-logs/`
- `auto-kanban.json`（各プロジェクトの worktree ルートに置かれる設定）

## 機能概要

**DevServerProcess は、タスクの worktree 上で起動される dev server プロセスを表すエンティティ**である。
`auto-kanban.json` の `server` スクリプト（例: `bun run start:dev`）を該当 worktree で実行し、
プロセスの状態・exit code・ログを永続化する。Session : DevServerProcess は 1:N だが、
**同一 session で running は最大 1 本**の制約を持つ。

## 設計意図

### なぜ「タスク単位」の dev server なのか

AI に「フロントエンドの色を変えて」と頼んだユーザーが次に知りたいのは「実際どう見えるか」。
選択肢:

1. main ブランチに merge してからローカル dev server で見る — 試行錯誤のテンポが悪い
2. AI の worktree に cd して手動で dev server を立ち上げる — 面倒で、後始末を忘れる
3. AutoKanban が AI の worktree 上で自動的に dev server を上げる — UI で完結

AutoKanban は 3 を選んだ。タスクごとに worktree で dev server を立ち上げられれば、
**「AI にお願い → ちょっと待つ → dev server で動作確認 → OK なら done」のサイクルが
カンバン内で閉じる**。

### CodingAgentProcess と別テーブルにした理由

同じ「プロセス」でも役割が全く違う:

| 側面 | CodingAgentProcess | DevServerProcess |
|---|---|---|
| 寿命 | 短命（数秒〜数分） | 長命（ユーザーが停止するまで） |
| 制御 | Stop / Resume / Fork / 承認 | Start / Stop のみ |
| ログ種別 | 会話（JSON イベント） | 標準 stdout / stderr |
| UI 表示 | 会話ビュー | 最新ログ + 動作中バッジ |

同じテーブルに混ぜると条件分岐だらけになって設計が破綻する。
Process を種別ごとに分けることで、それぞれに最適な Model / Repository が切れる。

### port 衝突をあえて解決しない設計判断

複数 workspace で dev server を並行起動すると port 衝突する。AutoKanban はこれを
解決しない:

- port 衝突解決は `PORT` 環境変数の動的割当などユーザー側で行う余地がある
- AutoKanban 側で port 管理すると `auto-kanban.json` の設定が複雑化する
- そもそも同時に dev server で見たいタスクは 1 個ずつ、というワークフローが現実的

### 同一 session で 1 本制約

同じ session 内で重複起動要求が来たら、**既存プロセスの ID を返して no-op**。
これにより「二重起動を誤って作らない」ことが保証される。別 attempt で動かしたい場合は
別 workspace を作ればよい。

### `auto-kanban.json` に `server` が無いプロジェクト

ライブラリなど dev server を持たないプロジェクトでは `INVALID_STATE` を返す。
UI 側は task-template の `condition: "no_dev_server"` と連携して、
dev server 関連のテンプレートタスクを出さないことで UX の整合性を保つ。

## 主要メンバー

- `id / sessionId`
- `status: "running" | "completed" | "failed" | "killed"`
- `exitCode: number | null`
- `startedAt / completedAt: Date | null`
- `createdAt / updatedAt`
- ログ: `dev_server_process_logs` テーブル（別エンティティ、プロセス ID で紐付け）

## 関連する動作

- ライフサイクル: [dev_server_lifecycle_is_managed](./dev_server_lifecycle_is_managed.md)
- 終了通知: [process_completion_updates_task_status](../callback/process_completion_updates_task_status.md)
  （processType: "devserver" 分岐）
