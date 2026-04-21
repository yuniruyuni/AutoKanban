---
id: "01KPPZWHXS4NJSCB1ZVD88TRP4"
name: "raw_sql_is_used_instead_of_orm"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/repositories/common/sql.ts` (`sql` tagged template + `sql.join` / `sql.raw` / `sql.empty`)
- `server/src/repositories/common/pg-client.ts` (PgDatabase 実装)
- `server/src/repositories/common/database.ts` (Database interface)
- `server/schema.sql` (唯一のスキーマ定義)
- 各 `server/src/repositories/<domain>/` の Repository 実装

## 機能概要

AutoKanban の DB アクセスは **Raw SQL + 独自の軽量 SQL Builder** で行う。
Drizzle / Prisma / Kysely のような ORM・クエリビルダーは採用しない。
`sql` タグ付きテンプレートリテラルで SQL を直接記述し、パラメータは自動でプレースホルダ化
（SQL インジェクション防止）。`PgDatabase` が `?` → `$1, $2, ...` への PostgreSQL 向け変換を引き受ける。

```ts
const fragment = sql`
  SELECT * FROM tasks
  WHERE project_id = ${projectId}
    AND status IN (${sql.join(statuses, ", ")})
  ORDER BY created_at DESC
`;
const rows = await ctx.db.queryAll(fragment);
```

## 設計意図

- **SQL をそのまま書ける価値**: JOIN / サブクエリ / Window 関数 / `ON CONFLICT DO UPDATE` を
  ORM の DSL に翻訳し直す苦労を避ける。PostgreSQL の全機能を直接使える
- **追加の学習コストを消す**: ORM 固有の API（Drizzle の where 合成、Prisma の relations 等）を
  覚えなくてよい。読み手は SQL を読むだけ
- **Specification Pattern との組み合わせ**: Model 層で宣言した仕様
  （例: `Task.ByProject(projectId)`) を Repository 層で `compToSQL` が SQL へ変換する。
  条件の再利用と合成は別カード
  [`specification_pattern_composes_db_filters`](./specification_pattern_composes_db_filters.md)
  で担保する
- **DB エンジン差の吸収は薄く**: SQLite → PostgreSQL 移行時、SQL Builder 側に手を入れたのは
  プレースホルダ変換のみ（`PgDatabase.finalize()`）。Repository のコードは無傷だった

## 検討された代替案

- **Drizzle / Prisma (ORM)**: 型安全なクエリビルダーとマイグレーション管理を備えるが、
  (a) 複雑クエリの逃げ道が弱い、(b) ORM 固有の抽象層が常に一段挟まる、(c) ORM のバージョン
  アップに追従する保守コストがかかる
- **Kysely (クエリビルダー)**: SQL に近い記法だがスキーマ定義の重複（TS 側のテーブル型定義）
  が必要。Raw SQL で直接書く以上のメリットが薄い
- **条件を文字列で直接渡す**: SQL インジェクションと型安全性の両方を失うので論外

## 主要メンバー

- `sql` (タグ付きテンプレート): `SQLFragment { query, params }` を返す
- `sql.join(values, sep)` / `sql.raw(str)` / `sql.empty`
- `PgDatabase.queryGet / queryAll / queryRun`: パラメータの順序は SQL Builder 側に閉じる
- Repository 標準メソッド: `get(ctx, spec)`, `list(ctx, spec, cursor)`, `upsert(ctx, entity)`,
  `delete(ctx, spec)`, `count(ctx, spec)`
- スキーマ管理: `server/schema.sql` が single source of truth、起動時に pgschema が差分適用
  （[`postgresql_is_embedded_for_storage`](./postgresql_is_embedded_for_storage.md)）

## 関連する動作

- [specification_pattern_composes_db_filters](./specification_pattern_composes_db_filters.md)
- [postgresql_is_embedded_for_storage](./postgresql_is_embedded_for_storage.md)
- [layered_architecture_separates_model_repository_usecase_presentation](./layered_architecture_separates_model_repository_usecase_presentation.md) — Repository 層の位置づけ
