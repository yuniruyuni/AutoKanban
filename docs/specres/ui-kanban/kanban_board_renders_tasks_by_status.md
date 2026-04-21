---
id: "01KPNTBSG7R884Y412A422AVPE"
name: "kanban_board_renders_tasks_by_status"
status: "draft"
---

## 関連ファイル

- `client/src/pages/KanbanPage.tsx`
- `client/src/components/project/KanbanBoard.tsx`
- `client/src/components/project/KanbanColumn.tsx`
- `client/src/components/project/KanbanCard.tsx`
- `client/src/store/ui.ts` (Valtio)

## 機能概要

プロジェクト画面（`/projects/:projectId`）のメイン UI。
5 カラム（`todo` / `inprogress` / `inreview` / `done` / `cancelled`）にタスクを振り分けて表示し、
ドラッグ＆ドロップでステータスを変更できる。各カードは `{ title, description snippet, latest agent status,
pending approval badge }` を表示。

## 設計意図

- **サーバー状態**: `trpc.task.list({ projectId })` + React Query のキャッシュ
- **ローカル UI 状態**: ドラッグ中のカード、展開状態などは Valtio
- ドロップ時に楽観的更新 + `trpc.task.update({ status })` を発行、失敗時は UI ロールバック

## シナリオ

### Render tasks grouped by status

1. ページ初期化で `trpc.task.list({ projectId })` + `trpc.project.get({ projectId })`
2. `KanbanBoard` が tasks を status で groupBy し、`KanbanColumn` に配る
3. 各 `KanbanCard` に最新 status バッジを表示

### Drag to change status

1. ユーザーが `todo` のカードを `inprogress` 列にドロップ
2. 楽観的更新で UI を即反映
3. `trpc.task.update({ taskId, status: "inprogress" })` を mutation
4. `inprogress` への遷移だった場合はエージェント起動ダイアログを開く
5. 失敗時は UI を元に戻す

## 失敗 / 例外

- `tRPCError` 時は toast で通知 + UI ロールバック
