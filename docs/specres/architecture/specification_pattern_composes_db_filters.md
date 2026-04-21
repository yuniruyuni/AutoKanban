---
id: "01KPPZWHXX6SCHAHJ36VA70ZJE"
name: "specification_pattern_composes_db_filters"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/models/common.ts` (`Comp<T>` / `defineSpecs` / `SpecsOf` / `and` / `or` / `not`)
- `server/src/models/task/index.ts`（など各 Model の namespace 内に `defineSpecs(...)` あり）
- 各 `server/src/repositories/<domain>/` の `*SpecToSQL` 関数 + `compToSQL`
- `server/src/repositories/common/sql-helpers.ts`

## 機能概要

DB クエリ条件を **Model 層で宣言**し、**Repository 層で SQL に変換**する。
条件は `Comp<T>` で `and` / `or` / `not` 合成可能。典型的な使い方:

```ts
// Model で条件定義（Task namespace 内）
const _specs = defineSpecs({
  ById: (id: string) => ({ id }),
  ByProject: (projectId: string) => ({ projectId }),
  ByStatuses: (...statuses: Task.Status[]) => ({ statuses }),
});

// Usecase で合成
const spec = Task.ByProject(projectId).and(Task.ByStatuses("todo", "inprogress"));

// Repository で変換
const where = compToSQL(spec, taskSpecToSQL);
const rows = await ctx.db.queryAll(sql`SELECT * FROM tasks WHERE ${where}`);
```

## 設計意図

- **条件の再利用性**: `Task.ByProject(projectId)` は `get / list / count / delete` すべてで
  使い回せる。1 条件 1 定義の DRY
- **関心の分離**: 「どんな条件か」は Model の責務、「SQL にどう落ちるか」は Repository の責務。
  `taskSpecToSQL()` という変換関数 1 箇所を読めば Repository の全実装が見える
- **型安全**: `defineSpecs()` + `SpecsOf<typeof _specs>` で `Task.Spec` 型が自動導出される。
  変換側（`taskSpecToSQL`）の switch を漏れなく書かないと TypeScript が拒否する
- **`compToSQL` で AND/OR/NOT を共通処理**: 各 Repository は基本述語の変換関数だけ書けば、
  合成ロジックは自動で処理される

## 検討された代替案

- **フィルターオブジェクト (`{ projectId, status }`) で渡す**: 素朴だが、OR / NOT の表現が
  困難。複雑な条件ほど Repository 内に分岐コードが溜まる
- **ORM のクエリビルダー (Drizzle の `where(eq, and, ...)` 等)**: 表現力は高いが ORM を背負う
  コストが割に合わない ([`raw_sql_is_used_instead_of_orm`](./raw_sql_is_used_instead_of_orm.md))
- **SQL 文字列を直接渡す**: 再利用も型安全も失われる

## 主要メンバー

- `Comp<T>` — 再帰的な and / or / not のコンポジット型
- `defineSpecs(obj)` — 各キーをファクトリ関数化して `{ type, ...fields }` を返す
- `SpecsOf<typeof x>` — defineSpecs の戻り値から Union 型を抽出
- `compToSQL(spec, convert)` — Repository の共通 AND/OR/NOT 処理
- `Repository.get(ctx, spec)` / `list(ctx, spec, cursor)` — 標準インターフェース

## 関連する動作

- [raw_sql_is_used_instead_of_orm](./raw_sql_is_used_instead_of_orm.md) — Spec → SQL の足場
- [usecase_is_executed_in_6_steps](./usecase_is_executed_in_6_steps.md) — read / write で使う
- [layered_architecture_separates_model_repository_usecase_presentation](./layered_architecture_separates_model_repository_usecase_presentation.md) — Model と Repository の境界
