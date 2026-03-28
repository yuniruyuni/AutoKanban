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

## docs参照

- 詳細: `docs/15-task-state-transitions.md` を参照
