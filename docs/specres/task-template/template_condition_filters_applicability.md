---
id: "01KPNTBSGFXEWD4TKRHYDT856F"
name: "template_condition_filters_applicability"
status: "draft"
---

## 関連ファイル

- `server/src/models/task-template/index.ts` (`TaskTemplate.Condition` 型)
- `server/src/usecases/project/create-project.ts` (condition 評価ロジック)
- `server/src/usecases/setup/seed-templates.ts`

## 機能概要

タスクテンプレートの `condition` フィールドは「このテンプレートを適用すべきか」を表すタグ。
現状の値は `null`（常時適用）と `"no_dev_server"`（dev server を持たないプロジェクト向け）の 2 種類。
プロジェクト作成時に `createProject` が `auto-kanban.json` を読んで適用判定を行う
（実装では現在は単純に `"no_dev_server"` はスキップ）。

## 設計意図

単純な文字列 enum で拡張可能にしておく。条件が複雑化したら評価関数を別ファイルに分離する予定。

## シナリオ

### Condition = null

1. 全プロジェクトで初期タスクとして作成される

### Condition = "no_dev_server"

1. `createProject` の write ステップで `tmpl.condition === "no_dev_server"` のテンプレートはスキップ
2. （将来的に）`auto-kanban.json` の解析結果と紐付けて判定する設計に拡張余地

## 失敗 / 例外

- 未知の condition 値は現在は silent skip（`"no_dev_server"` だけを判定）
