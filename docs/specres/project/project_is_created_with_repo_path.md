---
id: "01KPNSEAVR0V2FXNAGASW9P9FJ"
name: "project_is_created_with_repo_path"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/usecases/project/create-project.ts`
- `server/src/usecases/project/create-project.test.ts` (Test)
- `server/src/presentation/trpc/routers/project.ts` (`create` procedure)
- `server/src/models/project/index.ts`
- `client/src/pages/NewProjectPage.tsx`
- `client/src/components/project/ProjectForm.tsx`

## 機能概要

ユーザーが既存の Git リポジトリを指定して AutoKanban にプロジェクトを登録する。
登録と同時に `task_templates` テーブルのテンプレートから初期タスク群を生成する
（`condition: "no_dev_server"` のテンプレートはここではスキップされる）。

## 設計意図

プロジェクト作成は「リポジトリを AutoKanban の管理下に置く」宣言であり、
ここで弾いておきたい不整合は (1) 同じ `repoPath` の二重登録、(2) Git リポジトリでないパス、
(3) 初回コミットがないリポジトリ の 3 つ。重い IO（`ctx.repos.git.isGitRepo` / `listBranches`）は
`post` ステップに置き、DB トランザクションを先に閉じてから検証する。

## 主要メンバー

- `name: string` — 1 文字以上、trim 済み
- `repoPath: string` — 絶対パス想定。重複チェックの唯一の一意キー
- `branch?: string` — 省略時は `"main"`
- `description?: string | null`

## シナリオ

### 作成成功

1. クライアントが `trpc.project.create({ name, repoPath, branch?, description? })` を呼ぶ
2. `pre` で `name` / `repoPath` の空欄を弾く
3. `read` で `Project.ByRepoPath(repoPath)` が存在しないことを確認
4. `process` で `Project.create()` により ID と `createdAt/updatedAt` を発行
5. `write` で `projects` に upsert、併せて `task_templates.listAll()` から
   `condition !== "no_dev_server"` のテンプレートを初期タスクとして `tasks` に upsert
6. `post` で `git.isGitRepo(repoPath)` と `git.listBranches(repoPath).length > 0` を確認
7. 作成された `Project` をクライアントへ返却

### 空のリポジトリ（コミット無し）

1. `repoPath` は git リポジトリだが初回コミットがない
2. `post` の `listBranches` が空配列を返す
3. `fail("INVALID_INPUT", "The repository has no commits yet. ...")`
4. DB への書き込みは `write` で既に commit されているため、**ここで失敗するとプロジェクトは残る**
   （改善余地あり）

## 失敗 / 例外

- `INVALID_INPUT` — `name` または `repoPath` が空文字列
- `DUPLICATE` — `repoPath` が既存の Project と衝突（`existingProjectId` を details に含める）
- `INVALID_INPUT` — `repoPath` が git リポジトリでない（post ステップで検出）
- `INVALID_INPUT` — リポジトリにコミットが 1 つもない（post ステップで検出）
