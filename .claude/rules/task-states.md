---
paths:
  - server/src/**/task*
  - client/src/**/task*
  - client/src/**/Task*
---

# タスク状態遷移

- 5状態: `todo`, `inprogress`, `inreview`, `done`, `cancelled`
- **全状態間の遷移が許可されている**（制限なし）
- 状態遷移の副作用: Agent Stop, Chat Reset, Agent Resume
- 確認ダイアログ: 破壊的操作時のみ表示
- マージは fast-forward only

## specre 参照

- 遷移マトリクスと UI ダイアログ規約: `docs/specres/ui-kanban/task_kanban_dnd_transitions_trigger_side_effects.md`
- Task 概念: `docs/specres/task/task_is_a_unit_of_work_delegated_to_ai.md`
