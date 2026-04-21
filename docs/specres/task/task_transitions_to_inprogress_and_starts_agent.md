---
id: "01KPNSHJWAYW0CGTZ3AZ2HD42F"
name: "task_transitions_to_inprogress_and_starts_agent"
status: "draft"
---

## 関連ファイル

- `server/src/models/task/index.ts` (`Task.canTransition`)
- `server/src/usecases/task/update-task.ts`
- `server/src/usecases/execution/start-execution.ts`
- `client/src/components/project/KanbanCard.tsx`
- `client/src/components/chat/StartAgentDialog.tsx`
- `docs/specres/ui-kanban/task_kanban_dnd_transitions_trigger_side_effects.md` (遷移マトリクス)

## 機能概要

タスクを `todo | inreview | done | cancelled` から `inprogress` に動かすと、
そのタスクに対して Coding Agent 実行を起動するフロー。
状態遷移そのものは `trpc.task.update({ status: "inprogress" })` で行われ、
その直後にクライアント側から `trpc.execution.start(...)` が呼ばれる。

## 設計意図

遷移と agent 起動を 2 つの tRPC 呼び出しに分けるのは、ユーザーが **どの executor / variant
（Claude Code / Gemini、default / plan など）で起動するかを選ぶダイアログ**を
挟めるようにするため。サーバー側では遷移と起動は別コミット。

## 主要メンバー

- `Task.canTransition(from, to)` — 全状態間で `true`
- 起動ダイアログ: `StartAgentDialog.tsx` が `executor` / `variant` / `prompt` を収集

## シナリオ

### User-driven start

1. ユーザーがカンバンカードをドラッグで `inprogress` 列に移動、あるいは「Start Agent」ボタンを押す
2. クライアントが `StartAgentDialog` を開いて executor / variant / prompt を確定
3. `trpc.task.update({ taskId, status: "inprogress" })` を呼ぶ（chat reset は発生しない）
4. 続けて `trpc.execution.start({ taskId, executor, variant, prompt })` を呼ぶ
5. サーバー側で workspace / session / coding_agent_process が新規作成され、
   executor サブプロセスが spawn される（[`execution_is_started_for_task`](../execution/execution_is_started_for_task.md) 参照）

### Transition without agent start

1. タスクの状態だけを変えたい場合、UI 側で Agent 起動をスキップできる設定もある
2. `trpc.task.update` だけが呼ばれ、`inprogress` にはなるが agent は動かない
3. この場合、後で手動で `Start Agent` を押す必要がある

## 失敗 / 例外

- `NOT_FOUND` — `taskId` のタスクが存在しない
- executor バイナリが見つからない / 設定されていない場合は `execution.start` 側で fail する
