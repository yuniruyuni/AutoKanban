---
id: "01KPPZWHXYJQ6KJBGSCWD8NMKG"
name: "postgresql_is_embedded_for_storage"
status: "draft"
---

## 関連ファイル

- `server/src/infra/db/embedded-postgres.ts` (PG 起動管理)
- `server/src/infra/db/pgschema.ts` (schema.sql 差分適用)
- `server/src/repositories/common/pg-client.ts` (`PgDatabase` 実装)
- `server/src/repositories/common/database.ts` (`Database` interface)
- `server/schema.sql` (single source of truth for schema)
- `~/.auto-kanban/postgres/` (PG データディレクトリ)
- `~/.auto-kanban/bin/pgschema` (pgschema バイナリ)

## 機能概要

AutoKanban のストレージは **embedded-postgres + pgschema** の組み合わせで動く:

- **embedded-postgres** が PostgreSQL バイナリを初回起動時に DL、ローカルプロセスとして立ち上げる
- **pgschema** が `server/schema.sql` の内容と現在の DB 実態を比較し、差分を DDL として自動適用

ユーザーから見ると **ゼロセットアップ**: 外部 DB のインストールも migration script 管理も不要。
`bun run start:dev` だけで PG が立ち上がり、スキーマが最新状態に揃う。

起動フロー:

```
EmbeddedPostgresManager.start()
  ├─ （初回） PG バイナリ DL + initdb
  └─ PG プロセス起動
ensurePgSchema(connectionParams)  ← schema.sql の差分を pgschema が適用
new PgDatabase(poolConfig)        ← pg.Pool で接続
recoverOrphanedProcesses(db)      ← 前回起動の orphan process を cleanup
seedDefaults(db)                  ← デフォルト variant / template 投入
```

## 設計意図

- **スキーマ進化の自由度**: PostgreSQL の `ALTER TABLE` は型変更・制約変更・カラム削除すべて
  可能。schema 変更のたびに「テーブル再作成→データ移行→リネーム」を書く必要がない
- **宣言的スキーマの貫徹**: `server/schema.sql` が唯一の真実の源。migration file は作らない。
  pgschema が `schema.sql ↔ DB 現状` の差分を計算して適用する
- **正確な型**: `TIMESTAMPTZ` / `BOOLEAN` / `bigint` のネイティブ型が使える。
  SQLite 時代は `BOOLEAN` を `INTEGER 0/1` で代替し、`TIMESTAMPTZ` 相当の表現も曖昧だった
- **ゼロセットアップの維持**: PostgreSQL を使うためにユーザーが `brew install postgresql` や
  `docker compose up` をしなくて良い。embedded-postgres が自動でバイナリを用意する

### 経緯 (旧 ADR-0001 / ADR-0009 吸収)

- 初期は **bun:sqlite** を採用していた（シングルバイナリ配布と Bun ネイティブ統合を重視）。
  sqlite-auto-migrator と組み合わせて宣言的スキーマ管理を試みた
- しかし SQLite の `ALTER TABLE` 制限（カラム型変更・制約変更・削除が不可）で、
  スキーマ進化のたびに複雑なマイグレーションが発生し、宣言的管理が壊れた
- 2026-03-29 に embedded-postgres + pgschema へ移行。シングルバイナリ配布は諦めた代わりに
  スキーマ進化の自由度とネイティブ型の正確さを取った。初回起動時のバイナリ DL という
  UX コストは実用上許容範囲

## 検討された代替案

- **PGlite (WASM PostgreSQL)**: Bun 互換性の問題 + pgschema などの外部ツールが TCP 接続を
  要求するため WASM 単体では使えない
- **SQLite（継続）**: `ALTER TABLE` 制限で宣言的スキーマが実現しにくい。
  上記「経緯」の通り実際に行き詰まった
- **外部 PostgreSQL (Docker Compose / Homebrew)**: ゼロセットアップを損なう

## 主要メンバー

- `EmbeddedPostgresManager`: PG バイナリ DL + プロセス管理
- `ensurePgSchema()`: schema.sql 差分適用
- `PgDatabase implements Database`: 本プロジェクトの DB ラッパ（`?` → `$1, $2, ...` 変換もここ）
- `server/schema.sql`: スキーマ single source of truth
- 対応 OS: macOS + Linux（Windows 非対応）

## 関連する動作

- [raw_sql_is_used_instead_of_orm](./raw_sql_is_used_instead_of_orm.md) — 上に乗る SQL Builder
- [layered_architecture_separates_model_repository_usecase_presentation](./layered_architecture_separates_model_repository_usecase_presentation.md) — Repository 層の位置
- [usecase_is_executed_in_6_steps](./usecase_is_executed_in_6_steps.md) — トランザクション境界
