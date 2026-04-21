---
id: "01KPNTBSG96YB0X1BGW2WN6K9Q"
name: "task_fullscreen_view_shows_execution_and_workspace"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `client/src/pages/TaskFullscreenPage.tsx`
- `client/src/components/task/TaskDetailFullscreen.tsx`
- `client/src/components/chat/ExecutionPanel.tsx`
- `client/src/components/task/WorkspacePanel.tsx`
- `client/src/components/task/CreatePullRequestDialog.tsx`

## 機能概要

タスク詳細を画面全体に広げるビュー（`/projects/:projectId/tasks/:taskId/fullscreen`）。
左に会話、右に workspace 情報（ブランチ / ahead-behind / PR 状態 / dev server / diff 詳細）を
タブ切替で表示する。Create PR ダイアログもここから開く。

## シナリオ

### フルスクリーン表示

1. タスクサイドパネルの「拡大」ボタンで遷移
2. 同じ会話 / diff / approval 機能をフル画面で利用
3. WorkspacePanel が Git 情報 + dev server 状態 + worktree パスを表示

### PR ダイアログを開く

1. WorkspacePanel の「Create PR」を押す
2. `CreatePullRequestDialog` が開き、AI description 生成の選択肢がある
3. 最終的に `trpc.git.createPullRequest` を呼ぶ

## 失敗 / 例外

- Fullscreen URL 直接アクセス時は `trpc.task.get` の NOT_FOUND で 404 表示
