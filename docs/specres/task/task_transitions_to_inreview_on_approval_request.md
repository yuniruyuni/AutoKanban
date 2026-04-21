---
id: "01KPNSHJWC2NZQA92FWDK177XH"
name: "task_transitions_to_inreview_on_approval_request"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/models/task/index.ts` (`Task.toInReview`, `Task.restoreFromInReview`)
- `server/src/usecases/execution/on-approval-request.ts`
- `server/src/presentation/callback/routers/on-approval-request.ts`
- `client/src/components/chat/ApprovalCard.tsx`

## このカードの役割

**「なぜ `inreview` が独立ステータスとして必要か」** と **「approval request 経由の自動遷移の仕組み」**
を扱う。Stop ボタンや D&D による明示的な `inprogress → inreview` を含む全パターンは
[`task_kanban_dnd_transitions_trigger_side_effects`](../ui-kanban/task_kanban_dnd_transitions_trigger_side_effects.md)
を参照。

## 機能概要

実行中の Coding Agent がツール使用の承認を要求したとき、AutoKanban は自動的にタスクを
`inprogress → inreview` に遷移させる。ユーザーが ApprovalCard で承認/否認するまで agent は停止。
応答後、`restoreFromInReview` によってタスクは `inprogress` に戻る。

## 概念的背景: なぜ `inreview` を独立ステータスにしたか

カンバン系のツールでは通常 `todo / doing / done` の 3 状態で十分とされる。
AutoKanban がそこに **`inreview`** を足した理由は、AI エージェントの実行には
**「動いてはいるが、人間の判断待ちで止まっている」という特殊な状態**があるため。

`inprogress` のまま承認待ちにすると:

- カンバン一覧では他の active なタスクと見分けがつかない
- ユーザーが別タスクに気を取られていると、エージェントが止まっていることに気付かない
- 気付くのは「あれ、進んでないな」と思ってチャットを開いた数分〜数十分後

これは AutoKanban の核である**並列 AI 実行**と相性が悪い。並列で動かしている 3-5 タスクの
うち 1 つが承認待ちで止まっていることに 30 分気付かない、という失敗モードを防ぐために、
**「人間の判断待ち」だけを意味する専用ステータス `inreview`** を切り出した。

このステータスは:

- **自動で** `inprogress → inreview` に入る（ユーザー操作ではない）
- ApprovalCard で応答すると**自動で** `inprogress` に戻る
- カンバン上で他と区別される配色・バッジで表示される

人間は「あとどれが判断待ち？」をカンバンの `inreview` 列を見るだけで把握できる。

## 設計意図

`Task.toInReview(task): Task | null` は **`inprogress` のときだけ遷移**、それ以外は `null` を
返す。これにより「既に `inreview` や `cancelled` のタスクに二重で遷移をかける」のを防ぐ。
同様に `restoreFromInReview` も `inreview` からしか戻さない。

遷移は Executor → Server の `on-approval-request` コールバックをトリガーとして、
サーバー側で自動で行う（クライアントの状態管理に依存しない）。
これは「エージェントが静かに止まっていたら必ずカンバンで見える」ことを**サーバー側の不変条件**
として守るためで、UI の状態変数に責任を委ねない設計にしてある。

## 主要メンバー

- `Task.toInReview(task): Task | null` — `inprogress` のときだけ遷移、それ以外は `null`
- `Task.restoreFromInReview(task): Task | null` — `inreview` のときだけ `inprogress` に戻す

## シナリオ

### approval request 到着

1. Executor がツール使用前に Server へ `/callback/on-approval-request` を POST
2. `handleApprovalRequest` の write ステップで `CodingAgentProcess.toAwaitingApproval` と
   `Task.toInReview` を呼ぶ
3. 両方とも `upsert` されて DB に永続化
4. SSE で UI に伝播、ApprovalCard が表示される

### ユーザーが応答

1. ユーザーが ApprovalCard で Approve / Deny
2. `respond-to-approval.ts` が Approval レコードを更新
3. post ステップで Executor に permission response を送信
4. `finish` ステップで `CodingAgentProcess.restoreFromApproval` と
   `Task.restoreFromInReview` を呼んで `inprogress` に戻す

## 失敗 / 例外

- Approval が無限に pending のまま → タスクは `inreview` のまま残る（タイムアウトなし）
- Executor 側で crash → `restoreFromInReview` が呼ばれないため、手動で status を変える必要がある
