# ADR-0001: データベースエンジンの選定

## ステータス

廃止 (Superseded by [ADR-0011](./0011-postgresql-migration.md))

## 日付

2026-02-28

## 概要

当初bun:sqliteを採用したが、ALTER TABLE制限によるスキーマ管理の困難さから、2026-03-29にembedded-postgres + pgschemaへ移行した。

詳細は[ADR-0011: PostgreSQL移行](./0011-postgresql-migration.md)を参照。

## 当初の決定

**bun:sqlite を採用する。**

シングルバイナリ配布との整合性、Bunネイティブ統合による安定性、同期APIのシンプルさを根拠として採用。PGliteはBun互換性問題、embedded-postgresはシングルバイナリ配布不可を理由に見送った。

## 廃止の理由

- SQLiteの`ALTER TABLE`制限でスキーマ進化が困難
- sqlite-auto-migratorでは宣言的管理が不完全
- シングルバイナリ配布の優先度低下（AIエージェント統合・MCP化）
- embedded-postgresのゼロセットアップUXが実用的と判断
