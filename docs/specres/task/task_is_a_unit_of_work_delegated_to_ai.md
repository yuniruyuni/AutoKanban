---
id: "01KPNX4PA2SQRARM986Y6YDYBV"
name: "task_is_a_unit_of_work_delegated_to_ai"
status: "draft"
---

## 関連ファイル

- `server/src/models/task/index.ts`
- `server/schema/tables/tasks.sql`
- `server/src/repositories/task/`
- `docs/specres/ui-kanban/task_kanban_dnd_transitions_trigger_side_effects.md` (遷移マトリクス)

## 機能概要

**Task は、「AI エージェントに投げたい作業 1 件」を表すエンティティ**である。
カンバンボードの 1 枚のカードに対応し、5 状態 `todo / inprogress / inreview / done / cancelled` を
取る。`title + description` がそのままエージェント起動時の prompt 素材になるため、
Task を書くこと自体が「AI への依頼仕様」を書くことと等価。

## 設計意図

### なぜ「カンバンの 1 カード」より重い意味を持たせるか

一般的なタスク管理アプリでは、タスクは「やることメモ」程度の軽い意味しかない。
AutoKanban の Task はそれより**決定的に重い**:

- **AI エージェント実行の起動単位**になる。`title + description` が prompt になるため、
  タスクの書き方が AI の成果物の質を左右する
- **1 Task = 最大 1 active Workspace = 最大 1 active Coding Agent 実行** の原則により、
  並列実行の同期単位として機能する
- **ステータス遷移が副作用を伴う**（Agent Stop / Chat Reset / Agent Resume）

したがって「このタスクの description に何を書くか」は PR 単位の設計行為。
AutoKanban の使いこなしは「良いタスクを書けるか」にかなりの部分帰着する。

### なぜ 5 状態で、しかも全状態間遷移を許可するか

状態機械を 3 状態（todo/doing/done）で済ませられない理由:

- **`inreview`**: AI が承認待ちで止まっている状態を**カンバン上で見える化**したい。
  `inprogress` と混ぜるとチャットを開くまで気付けない
- **`cancelled`**: `done` でも `todo` でもない「やらないことにした」を残したい。
  後で履歴を辿るときに「完了した」と「やめた」を区別する価値がある

全状態間遷移を許可するのは、現実のワークフローが直線ではないから:

- `done` にした後「やっぱり追加で直したい」で `inprogress` に戻す
- `inreview` から直接 `cancelled` に飛ぶ（承認せずに中止）
- `cancelled` を復活させて再開

この自由度を `Task.canTransition` で常に `true` を返すことで表現し、
遷移そのものは自由、**副作用のルール**（例: `todo` への遷移だけは Chat Reset を伴う）を
モデル層の関数（`needsChatReset` / `toInReview` / `toDone`）に集約する、という設計にしている。

### Factory で初期状態を固定

`Task.create()` は必ず `status: "todo"` で初期化し、`generateId()` で ID を振る。
「AI エージェント未起動の状態から始まる」という不変条件を型レベルで強制する。

## 主要メンバー

- `id / projectId / title / description`
- `status: Task.Status` — 5 状態
- `createdAt / updatedAt`
- メソッド: `canTransition(from, to): boolean` — 現状は常に `true`
- メソッド: `needsChatReset(from, to): boolean` — `to === "todo" && from !== "todo"` のみ真
- メソッド: `toInReview / restoreFromInReview / toDone` — 遷移補助

## 関連する動作

- 作成: [task_is_created_in_todo](./task_is_created_in_todo.md)
  / [task_is_created_from_template](./task_is_created_from_template.md) (将来)
- 取得・一覧: `task_detail_is_fetched` / `tasks_are_listed_for_project`
- 更新・削除: `task_is_updated` / `task_is_deleted_with_optional_worktree_cleanup`
- 状態遷移 4 種: `task_transitions_to_*` カード群
