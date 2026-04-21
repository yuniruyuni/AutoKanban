---
id: "01KPNX4PABBTT3HZ1GWK4VRR7M"
name: "approval_is_the_persistent_tool_confirmation"
status: "draft"
---

## 関連ファイル

- `server/src/models/approval/index.ts`
- `server/schema/tables/approvals.sql`
- `server/src/repositories/approval/`
- `server/src/repositories/approval-store/` (in-memory Promise 管理の表と裏)
- `client/src/components/chat/ApprovalCard.tsx`

## 機能概要

**Approval は、Coding Agent のツール使用に対する「ユーザー承認」を DB 永続化するエンティティ**である。
状態は `pending / approved / denied`。`approvals` テーブルと in-memory の `ApprovalStore`
（Promise 管理）の両方で管理されており、ApprovalCard UI を通じてユーザーが応答する。

## 設計意図

### Permission との分離

AutoKanban には承認系のエンティティが **2 つ**ある:

- **Approval**（このカード）— DB 永続、履歴として残したい承認
- **Permission** — in-memory、Claude Code control protocol の即時応答

両者は「どこで／どう残したいか」という永続化戦略が根本的に違うため、
単一テーブルに混ぜると設計が破綻する。Approval は**「後で履歴として参照したい」性質の承認**
だけを担当する。

Approval の代表的なユースケース:

- 破壊的コマンド（`rm -rf` を含む bash）の事前確認
- プロジェクト外ファイルの読み書きの確認
- 長時間実行ツールの開始確認
- Plan モードの計画 review

これらは「いつ何を承認 / 拒否したか」を**ユーザーが後で振り返りたい**性質を持つ。
したがって DB 永続化が必要。

### DB + in-memory Promise の二層構造

Approval の呼び出しフローは次のように独特:

1. Callback 側（`handleApprovalRequest`）が Approval レコードを `pending` で DB に作る
2. 同時に `approvalStore.createAndWait(approval)` で Promise を作って **await する**
3. ApprovalCard 側は DB を読んで pending Approval を表示、ユーザー操作で
   `approvalStore.respond(id, status, reason)` を呼ぶ
4. `respond` が対応 Promise を resolve する
5. Callback 側の await が抜けて Executor に permission response を送る
6. `Approval.respond(approval, status, reason)` で DB レコードも最終化

なぜ二層か:

- **DB** だけだと「ユーザーが応答してから agent が進むまで」polling が必要で遅い
- **Promise** だけだとサーバー再起動で消える（再起動後に pending が UI から消えて詰む）
- 両方持てば「高速 + 堅牢」を両立できる

### Approval の識別子

- `toolName` / `toolCallId` で「どのツール呼び出しに対する承認か」を記録
- `executionProcessId` で「どのプロセスの判断か」を紐付け
- 応答時の `reason` で拒否理由を残す（Claude Code に伝えて、別のアプローチを試させる）

## 主要メンバー

- `id / executionProcessId`
- `toolName: string` — 対象ツール名（例: `"bash"`, `"write_file"`）
- `toolCallId: string` — Claude Code 側のツール呼び出し ID
- `status: "pending" | "approved" | "denied"`
- `reason: string | null`
- `createdAt / respondedAt / updatedAt`
- メソッド: `Approval.create(...)` / `Approval.respond(approval, status, reason)`

## 関連する動作

- 発生: [approval_request_is_detected_and_persisted](../callback/approval_request_is_detected_and_persisted.md)
- 応答: [approval_is_responded_from_approval_card](./approval_is_responded_from_approval_card.md)
- 一覧: [pending_approvals_are_fetched_for_execution](./pending_approvals_are_fetched_for_execution.md)
- 対比: [permission_is_the_ephemeral_control_request](../permission/permission_is_the_ephemeral_control_request.md)
