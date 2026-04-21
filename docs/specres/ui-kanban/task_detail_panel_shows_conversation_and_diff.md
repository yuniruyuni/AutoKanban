---
id: "01KPNTBSG89TW2BEMSHJBG0C96"
name: "task_detail_panel_shows_conversation_and_diff"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `client/src/components/task/TaskDetailPanel.tsx`
- `client/src/components/chat/ConversationPanel.tsx`
- `client/src/components/chat/FollowUpInput.tsx`
- `client/src/components/chat/ApprovalCard.tsx`
- `client/src/components/task/diff-panel/DiffPanel.tsx`
- `client/src/components/chat/AttemptSwitcher.tsx`

## 機能概要

タスクを選択するとカンバンの右側（または下側）にサイドパネルが開き、
(1) 過去の Coding Agent 会話（structured log stream）、(2) follow-up 入力、(3) ApprovalCard、
(4) git diff プレビュー、(5) attempt 切替を表示する。

## シナリオ

### Open panel

1. カードをクリックすると URL が `/projects/:projectId/tasks/:taskId` に変わる
2. `trpc.task.get` + `trpc.execution.getLatest` で初期データを取得
3. `/sse/structured-logs/<processId>` を購読して会話を描画
4. 並行して `trpc.git.getDiffs` でファイル一覧を取得

### Follow-up message

1. FollowUpInput で入力 → enter で送信
2. `trpc.execution.queueMessage` を呼び、送信結果（sent or queued）を表示

### Approval interaction

1. 新しい approval が届くと ApprovalCard が挿入される
2. Approve / Deny を選ぶと `trpc.approval.respond` を呼ぶ

### Attempt switching

1. AttemptSwitcher が `trpc.workspace.listAttempts` で過去 attempt を並べる
2. 選択すると表示する会話 / diff が切り替わる

## 失敗 / 例外

- SSE 接続断は自動再接続、それでも途切れるなら UI に notice
