---
id: "01KPNX4PA1X0NY458AYEPRTDPM"
name: "project_is_a_git_repository_under_management"
status: "draft"
---

## 関連ファイル

- `server/src/models/project/index.ts`
- `server/schema/tables/projects.sql`
- `server/src/repositories/project/`

## 機能概要

**Project は、AutoKanban が管理対象に置いた Git リポジトリ 1 つ分を表すエンティティ**である。
ユーザーがローカルの Git リポジトリを AutoKanban に登録すると、その参照が Project レコードとして
作られ、以後そのリポジトリ配下の全タスクと作業環境は Project の下にぶら下がる。

## 設計意図

### なぜ Project を切り出したか

AutoKanban は「任意のローカル Git リポジトリに AI エージェントを差し向ける」ツールなので、
「どのリポジトリに触って良いか」という**明示的な許可の単位**が必要になる。これが Project。
Project が存在しないディレクトリに worktree を作ることは設計上できないため、
パスの取り違えで予期しない場所を破壊する事故が起きない。

また、カンバンと AI 実行という **2 つの仕組みの共通の親**としての役割もある:

- カンバン側から見ると、Project はタスクのグルーピング単位
- AI 実行側から見ると、Project は worktree の生成元リポジトリ
- 両者を同じエンティティの子にすることで、「タスクを動かすと同じリポジトリの worktree が作られる」
  という自明な繋がりを DB 構造レベルで保証する

### 1 Project = 1 Repo 固定にした理由

Monorepo のように複数パッケージが同居するリポジトリでも、**AutoKanban から見れば 1 Project**。
パッケージ単位で Project を分けたくなる衝動はあるが、それをやると:

- Git worktree は**リポジトリ単位**でしか作れないため、Project の粒度と worktree の粒度が
  ずれて設計が破綻する
- 1 つの実装タスクが複数パッケージにまたがる（よくある）とき、
  どの Project に属させるか決めがたい

よって「1 Project = 1 Git リポジトリ」で固定し、モノレポ内のパッケージ区別は
タスクの粒度や worktree 内のディレクトリで吸収する。

### Workspace からは junction 越しに参照

Workspace は Project を直接参照せず、`WorkspaceRepo` という junction 越しに繋ぐ。
現状は 1:1 しか使っていないが、将来「1 workspace で複数リポジトリを触る」要件（関連リポの同期変更など）を
入れる余地を残している。junction を入れるコストは小さく、後から追加するコストは大きい、という判断。

## 主要メンバー

- `id: string` — Project の一意 ID
- `name: string` — 表示名（UI カード、worktree 名の素材）
- `description: string | null`
- `repoPath: string` — ローカル絶対パス。**一意キー**で、同じパスを 2 重登録不可
- `branch: string` — デフォルト targetBranch（通常 `main`）。worktree 作成時の分岐元
- `createdAt / updatedAt: Date`

## 関連する動作

- 作成: [project_is_created_with_repo_path](./project_is_created_with_repo_path.md)
- 一覧 / 取得 / 更新 / 削除: 同ドメインの `projects_are_listed` / `project_is_fetched_by_id` /
  `project_is_updated` / `project_is_deleted_with_optional_worktrees`
- ディレクトリ選択: [directory_is_browsed_for_repo_path_selection](./directory_is_browsed_for_repo_path_selection.md)
- Git 初期化: [git_repo_is_initialized_for_new_directory](./git_repo_is_initialized_for_new_directory.md)
