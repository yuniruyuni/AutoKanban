---
id: "01KPNX4PAFDPFGKQKSWRHPM2XV"
name: "task_template_is_an_initial_task_preset"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/models/task-template/index.ts`
- `server/schema/tables/task_templates.sql`
- `server/src/usecases/setup/seed-templates.ts` (初回 seed)
- `server/src/usecases/project/create-project.ts` (適用先)
- `client/src/pages/settings/TaskTemplatePage.tsx`

## 機能概要

**TaskTemplate は、プロジェクト作成時に自動で初期タスクを生成する雛形エンティティ**である。
`{ title, description, condition, sortOrder }` を持ち、`createProject` の write ステップで
全テンプレートを走査し、`condition` を満たすものからタスクを作って `tasks` に挿入する。

## 設計意図

### なぜ空のプロジェクトではなく雛形を入れるか

新しいリポジトリを AutoKanban に登録した直後の最初のハードルは「最初のタスクを書く」こと。
これには:

- タスクに何を書けば AI が動きやすいかの感覚
- そもそもどういう粒度でタスクを切るか
- AutoKanban の「AI にお願いする」スタイルに慣れる

という学習コストがある。完全に空のカンバンから始めると、初回ユーザーは何を書いていいか
分からず離脱する可能性が高い。

TaskTemplate は**典型的な初期タスクを自動で並べる**ことで:

- 「こういう粒度で書けばいいのか」の見本を提供
- 例: "README を整備する" / "CI/CD を設定する" / "依存を最新化する" など
- ユーザーは不要なら消せばよく、使えるなら即 AI 実行に進める

### condition を設けた意図

プロジェクトの性質（ライブラリ / アプリ、dev server の有無など）によって、
適切な初期タスクは異なる。例えば「フロントエンド画面の動作確認」は dev server がない
プロジェクトでは意味がない。

`condition` フィールドに applicability 判定タグを持たせ、`createProject` 時に評価することで:

- dev server なしのプロジェクトには dev server 関連タスクを出さない
- （将来）言語別、フレームワーク別の条件分岐を追加できる

現状は `null`（常時適用）と `"no_dev_server"`（dev server なしなら出さない）の 2 種類のみ。
拡張は必要になったときに足す方針（YAGNI）。

### 初回起動で seed、以降は手動

`setup/seed-templates.ts` は **初回起動時のみ**デフォルトテンプレートを挿入する。
ユーザーが削除したテンプレートを再起動時に勝手に再生成されると鬱陶しいので、
seed は冪等でなく「テンプレートが 1 件も無ければ入れる」のような単純ロジック。
以降のメンテナンスはすべて `/settings/task-templates` 画面で手動。

## 主要メンバー

- `id / title / description`
- `condition: "no_dev_server" | null` — 適用条件タグ
- `sortOrder: number` — プロジェクト作成時のタスク並び順
- `createdAt / updatedAt`

## 関連する動作

- 管理: [templates_are_listed_and_created](./templates_are_listed_and_created.md)
- 条件判定: [template_condition_filters_applicability](./template_condition_filters_applicability.md)
- 適用: [project_is_created_with_repo_path](../project/project_is_created_with_repo_path.md) の write ステップ
