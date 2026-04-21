---
id: "01KPNSJ3R2G1397A2C25KH9821"
name: "approval_request_is_detected_and_persisted"
status: "draft"
---

## 関連ファイル

- `server/src/usecases/execution/on-approval-request.ts` (`handleApprovalRequest`)
- `server/src/presentation/callback/routers/on-approval-request.ts`
- `server/src/models/driver-approval-request/index.ts`
- `server/src/models/approval/index.ts`
- `server/src/repositories/approval-store/`
- `client/src/components/chat/ApprovalCard.tsx`

## 機能概要

Coding Agent がツール使用の permission を要求したとき、Executor が AutoKanban Server に送る callback。
サーバーはそれを受けて:
1. `CodingAgentProcess.toAwaitingApproval` + `Task.toInReview` で状態を承認待ちに遷移
2. `Approval.create` で DB に永続化（`approvalStore.createAndWait` が Promise を返す）
3. ユーザーが ApprovalCard から応答するまでブロック
4. 応答後、Executor に permission response を送り（control protocol の `request_id` を使う）、
   status を元に戻す

## 概念的背景: Approval と Permission の分離

AutoKanban には「承認」に関するエンティティが **2 つ**ある:

| 名前 | 保管先 | ライフサイクル | UI | 用途 |
|---|---|---|---|---|
| **Approval** | DB `approvals` テーブル | 永続 | ApprovalCard（カンバン & チャット） | ユーザー確認が必要なツール使用、履歴として残したい |
| **Permission** | `permissionStore`（in-memory） | 揮発（Executor 生存中のみ） | PermissionResponseInput | Claude Code の control protocol 即応答、タイムアウト有り |

なぜ 2 種類あるか:

- Claude Code は `request_id` ベースの **control protocol** で permission request を送ってくるが、
  そのうちの一部は「即答しないと進まない、秒単位で消費される」性質（Permission）
- もう一部は「ユーザーに見せて、場合によっては手を止めてもらう」性質（Approval）

両者を 1 つのテーブルで扱うと、性質の違う永続化戦略（TTL vs 履歴保全）が混ざって設計が壊れる。
AutoKanban は明示的に別エンティティに分け、
「**DB に残したい承認 = Approval**」「**即時応答の control = Permission**」という線引きを
カード単位で維持している。

このカードは **Approval 経路の Executor → Server 側の起動点**にあたる。
対の UI 側は [`approval_is_responded_from_approval_card`](../approval/approval_is_responded_from_approval_card.md)。

## 設計意図

`Approval` は **DB 永続化される承認**で、ApprovalCard に表示してユーザー操作で応答する。
一方の [`permission_request_is_approved_or_denied`](../permission/permission_request_is_approved_or_denied.md)
は Claude Code の in-flight permission を即時応答する別経路（in-memory、DB 非永続）。

プロトコル制御 ID（`protocolContext.requestId`）を正しく渡さないと Claude Code が応答を無視するため、
`toolCallId` ではなく control request の `requestId` を優先する実装になっている。
これは Claude Code の仕様上の微妙な点で、`toolCallId` は「どのツール呼び出しか」の参照、
`requestId` は「どの control request に対する応答か」の参照であり、
permission response は後者でないと hooked されない。

**タスクを `inreview` に遷移する意図**: カンバン上で「いまこのタスクは手が止まっていて、
ユーザーの判断待ちである」を視覚化するため。AI 実行中ずっと `inprogress` のままだと、
チャット UI を開かないと承認待ちに気付けない。`inreview` バッジでカンバン一覧から
すぐわかるようにする。

## シナリオ

### Approval request arrives

1. Executor が `/callback/on-approval-request` に `DriverApprovalRequest` を POST
2. `handleApprovalRequest` の read で process → session → workspace → task を辿る
3. write で `CodingAgentProcess.toAwaitingApproval` と `Task.toInReview` を upsert、
   Approval レコードを pending で新規作成
4. post で `approvalStore.createAndWait(approval)` が ApprovalCard からの応答を待つ
5. 応答を受けたら `executor.sendPermissionResponse(processId, requestId, approved, ...)` で返す
6. finish で `CodingAgentProcess.restoreFromApproval` と `Task.restoreFromInReview` で状態復元

### Process / task missing

1. callback が来たタイミングで process が既に消えている等のエッジケース
2. 該当する status 更新はスキップされ、Approval レコードだけ残る（`taskId: null`）
3. finish の復元もスキップ

## 失敗 / 例外

- ユーザーが ApprovalCard で応答しないと post ステップで無限待機（タイムアウト未実装）
- Executor 側が callback 前に死んだ場合、process は `killed`、Approval は pending のまま残る
