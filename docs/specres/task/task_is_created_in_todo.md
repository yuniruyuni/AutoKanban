---
id: "01KPNSHJW0CXD6X1YSAFEWHKXP"
name: "task_is_created_in_todo"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/usecases/task/create-task.ts`
- `server/src/usecases/task/create-task.test.ts` (Test)
- `server/src/presentation/trpc/routers/task.ts` (`create` procedure)
- `server/src/models/task/index.ts` (`Task.create`)
- `client/src/components/task/TaskForm.tsx`

## 機能概要

既存プロジェクトに新しいタスクを `todo` 状態で作成する。
`Task.create` ファクトリが `id` (`generateId()`)、`createdAt/updatedAt`、
`status: "todo"` を強制的にセットする。

## 概念的背景: Task とは「AI に頼みたい 1 件」

AutoKanban の Task は一般的なタスク管理アプリの「やること」より**強い意味**を持つ:

- **AI エージェントに丸ごと投げる単位**になる（`title + description` がそのまま prompt 素材）
- **1 Task = 最大 1 active Workspace = 最大 1 active Coding Agent 実行** の原則で、
  エージェント同士の実行単位と 1:1:1 に対応する
- ステータス遷移は単なる表示ではなく、**Agent 起動・停止・Chat Reset** という副作用の
  トリガーになる

したがって「このタスクの description には何を書くか」はそのまま AI の仕事範囲を決める。
曖昧な description は曖昧な実装を生むので、タスクを書く行為自体が PR 単位の設計行為になる
（AutoKanban の使いこなしは「良いタスクを書けるか」に帰着する）。

新規作成時に `status: "todo"` で固定するのはこの前提の帰結: **まだ AI を走らせていない状態**
（worktree なし、session なし、process なし）からしか Task のライフサイクルは始まらない。

## 主要メンバー

- `projectId: string` — 親 Project の ID
- `title: string` — 1 文字以上
- `description?: string | null`

## シナリオ

### Successful creation

1. クライアントが `trpc.task.create({ projectId, title, description? })` を呼ぶ
2. `read` で `Project.ById(projectId)` の存在を確認
3. `process` で `Task.create()` により ID と `status: "todo"` を発行
4. `write` で `tasks` に upsert
5. 作成された `Task` を返却

### Parent project missing

1. `projectId` に対応する Project が無い
2. `fail("NOT_FOUND", "Project not found", { projectId })`

## 失敗 / 例外

- `NOT_FOUND` — `projectId` のプロジェクトが存在しない
- Zod validation: `title` が空文字列の場合は Presentation 層で `BAD_REQUEST`
