---
id: "01KPNSJ3R75HS06WT3HS01ZHAZ"
name: "pending_approvals_are_fetched_for_execution"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/usecases/approval/respond-to-approval.ts` (`getPendingApprovals`)
- `server/src/presentation/trpc/routers/approval.ts`
- `server/src/repositories/approval-store/`

## 機能概要

特定の `executionProcessId` に対して pending な承認の一覧を取得する。
まず in-memory store（通常時のホットパス）を確認し、空なら DB フォールバック
（サーバー再起動後の復旧用）を使う。UI 側はこれを polling して ApprovalCard を表示 / 非表示する。

## 設計意図

サーバー再起動時、in-memory の pending Promise は失われるが、DB には `status: "pending"` の
Approval レコードが残っている。この DB フォールバックにより、再起動後も
「続きから応答」が可能。ただし再起動後は Promise が無いため、応答しても
Executor 側には通知が飛ばない（Executor 側は既に死んでいる）— `queueMessage` の resume 経路で
改めて続きを開始する流れになる。

## シナリオ

### Normal fetch (in-memory)

1. UI が polling で `trpc.approval.getPending({ executionProcessId })`
2. `read` で DB の pending を取得（fallback 用の先行計算）
3. `post` で `approvalStore.listPending(executionProcessId)` を確認
4. in-memory に pending があればそれを返す

### DB fallback after restart

1. 再起動直後、in-memory は空
2. DB に残っていた pending Approval を返す
3. UI は ApprovalCard を表示（ただし respond しても Executor は既にいない）

## 失敗 / 例外

- 通常は fail しない、空配列を返すだけ
