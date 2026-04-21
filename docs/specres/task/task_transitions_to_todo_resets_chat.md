---
id: "01KPNSHJWEV82CG0H0BXSJ9T8G"
name: "task_transitions_to_todo_resets_chat"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/models/task/index.ts` (`Task.needsChatReset`)
- `server/src/usecases/task/update-task.ts`
- `server/src/usecases/run-cleanup-before-removal.ts`

## このカードの役割

**「なぜ `todo` への遷移だけが Chat Reset を意味するのか」**という設計意図を扱う。
D&D マトリクスの個々のセル（副作用・確認ダイアログ文言）は
[`task_kanban_dnd_transitions_trigger_side_effects`](../ui-kanban/task_kanban_dnd_transitions_trigger_side_effects.md)
を参照。

## 機能概要

タスクが **`todo` 以外のステータスから `todo` に戻された**とき、
そのタスクの全 workspace を `archived: true` にし、worktree ディレクトリを物理削除する。
ブランチは保持され（履歴として残る）、新しく attempt を作り直す前提。

## 概念的背景: Chat Reset というイベントを作った意図

「タスクを `todo` に戻す」操作には、ユーザー視点で **2 つの意味**があり得る:

- **単に状態表示を戻したい** — カンバン上のバッジの見た目を変えるだけ
- **やり直したい** — 今までの作業を捨てて、次回実行は新しい attempt で始めたい

AutoKanban は後者を採用している。理由:

- 前者なら、そもそもタスクの状態を戻す必要がない（保留にしたければ `cancelled` で良い）
- 「`todo` に戻す = やり直す」という semantic で UI を統一した方が、
  ユーザーの「失敗したので白紙に戻したい」という直感に合う
- ただし「白紙に戻す」をそのまま実装して worktree も DB レコードも全消しすると、
  過去の失敗から学ぶ材料（diff、対話ログ、ブランチ）まで消えてしまう

折衷として **Chat Reset** というイベントを概念化した: 
**「会話と worktree は捨てるが、ブランチ・DB の履歴・過去 workspace は残す」**。
これにより次回の実行は真新しい worktree から始まるが、
AttemptSwitcher で過去の対話と diff を掘り起こせる状態を維持する。

## 設計意図

`Task.needsChatReset(from, to)` が分岐条件を一箇所に集約している
（`to === "todo" && from !== "todo"`）。この関数がビジネスルールの single source of truth で、
`update-task.ts` の read / process / write / post の各ステップは needsChatReset の真偽を
引き回すだけの実装にしてある。

`deleteBranch: false` で worktree だけ消す選択は、ブランチを残すことの最大の価値
（過去 attempt の diff が常に main と比較可能）を守るため。空のブランチが溜まるコストは
個人利用規模では無視できる。

## 主要メンバー

- `Task.needsChatReset(from, to): boolean`
- Workspace の `archived: boolean` — true なら attempt セレクターに出てこない
- worktree 削除は `removeAllWorktrees(wsId, [project], true, false)` で `deleteBranch: false`

## シナリオ

### todo に戻して chat リセット

1. ユーザーが `inprogress` / `inreview` / `done` / `cancelled` のタスクを `todo` にドラッグ
2. `trpc.task.update({ taskId, status: "todo" })`
3. `read` ステップで `needsChatReset: true`、project と全 workspace を収集
4. `write` でタスクを更新、全 workspace を archive
5. `post` で cleanup スクリプトを実行してから worktree を削除（ブランチは保持）
6. `worktree.pruneWorktrees(project)` でゴミ entry を整理

### todo のまま維持（no-op）

1. `from === "todo"` かつ `to === "todo"` なら `needsChatReset: false`
2. workspace / worktree には何も影響しない

## 失敗 / 例外

- 個別 workspace の worktree 削除失敗は warning ログのみ
- `pruneWorktrees` の失敗も warning ログのみ
