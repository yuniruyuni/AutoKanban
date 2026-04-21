---
id: "01KPNSJ3R6ZE147WHQKD0ASB9A"
name: "approval_is_responded_from_approval_card"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/usecases/approval/respond-to-approval.ts` (`respondToApproval`)
- `server/src/presentation/trpc/routers/approval.ts` (`respond` procedure)
- `server/src/repositories/approval-store/`
- `server/src/models/approval/index.ts` (`Approval.respond`)
- `client/src/components/chat/ApprovalCard.tsx`

## 機能概要

ApprovalCard の "Approve" / "Deny" ボタン操作で、DB に pending として残っている
`Approval` レコードを最終化する。`approvalStore.respond` が
[`approval_request_is_detected_and_persisted`](../callback/approval_request_is_detected_and_persisted.md)
で awaiting している Promise を resolve する。Promise が resolve すると Executor に
permission response が送信され、Coding Agent 実行が再開される。

## 設計意図

ApprovalStore は **DB 永続化（`approvals` テーブル）** と **in-memory Promise** の両方を持つ。
DB 永続化により「サーバー再起動後も pending を回復できる」、
in-memory Promise により「ApprovalCard のクリックで即座に agent を再開できる」を両立する。
`respond` 呼び出し側（ApprovalCard）は Promise の存在を知らない（ただ DB を更新する感覚で使える）。

## シナリオ

### Approve

1. ユーザーが ApprovalCard で "Approve" を押す
2. `trpc.approval.respond({ approvalId, executionProcessId, status: "approved", reason? })`
3. `read` で Approval を取得、`status === "pending"` と executionProcessId 一致を検証
4. `post` で `approvalStore.respond(approvalId, "approved", reason)` → waiting Promise が resolve
5. `finish` で `Approval.respond(approval, "approved", reason)` をして upsert
6. 対応する callback 側（`handleApprovalRequest`）の post が続行し、executor に permission_response 送信

### Deny

1. 同じ流れで `status: "denied"` を送る
2. `reason` は拒否理由（Claude Code に伝わる）

## 失敗 / 例外

- `NOT_FOUND` — approvalId が存在しない
- `INVALID_STATE` — 既に responded 済み、または executionProcessId が一致しない
