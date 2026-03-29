# ADR-0009: sqlite-auto-migrator採用

## ステータス

廃止 (Superseded by [ADR-0011](./0011-postgresql-migration.md))

## 日付

2026-02-28

## 概要

当初sqlite-auto-migratorを採用して宣言的スキーマ管理を実現していたが、2026-03-29にPostgreSQL移行に伴いpgschemaへ移行した。

詳細は[ADR-0011: PostgreSQL移行](./0011-postgresql-migration.md)を参照。

## 当初の決定

**sqlite-auto-migratorを採用する。**

npm公開済み、Bun対応、宣言的スキーマ管理（schema.sqlから差分を自動計算）を根拠として採用。

## 廃止の理由

- SQLiteの`ALTER TABLE`制限により、宣言的管理であっても複雑なマイグレーションが発生
- PostgreSQL移行に伴い、pgschemaが同じ宣言的アプローチをより完全に実現
- pgschemaはschema.sqlの差分を直接PostgreSQLに適用し、migration scriptファイルが不要
