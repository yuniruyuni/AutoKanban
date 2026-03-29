# ADR-0011: PostgreSQL移行（embedded-postgres + pgschema）

## ステータス

採用 (Accepted)

## 日付

2026-03-29

## コンテキスト

Auto KanbanではADR-0001でbun:sqlite、ADR-0009でsqlite-auto-migratorを採用していた。開発を進める中で以下の問題が顕在化した：

### SQLiteの制約

- **ALTER TABLE制限**: SQLiteは`ALTER TABLE`でカラム型変更・制約変更・カラム削除が不可能。スキーマ進化のたびに「テーブル再作成→データ移行→リネーム」が必要
- **sqlite-auto-migratorの限界**: 上記制約に起因して、宣言的スキーマ管理であってもマイグレーションが複雑化・失敗するケースが発生
- **型の制約**: `BOOLEAN`型がなく`INTEGER`で代替、`TIMESTAMPTZ`がなくタイムゾーン管理が曖昧

### ゼロセットアップUXの維持

PostgreSQLへの移行にあたり、ユーザーに外部DBのインストールを要求しない方法が必要だった。

### 検討した選択肢

#### 選択肢1: PGlite (WASM PostgreSQL)

ADR-0001でも検討済み。2026年3月時点でもBun互換性問題が残存。特にpgschemaなどの外部ツールがTCP接続を前提とするため、WASMでは利用不可。

#### 選択肢2: embedded-postgres + pgschema

- **embedded-postgres**: PostgreSQLバイナリを自動DLし、ローカルプロセスとして起動
- **pgschema**: schema.sqlから直接DDL差分を計算・適用するGoバイナリ。migration scriptが不要

**利点:**
- 本物のPostgreSQL（全DDL操作サポート）
- pgschemaによる完全宣言的スキーマ管理（schema.sql編集→起動時に自動適用）
- migration scriptファイルの管理が不要
- ゼロセットアップ（初回起動時にバイナリ自動DL）

**欠点:**
- シングルバイナリ配布は不可能（PGバイナリ別途必要）
- 初回起動時のDL待ち（PGバイナリ + pgschemaバイナリ）
- macOS + Linuxのみ対応（Windowsは非対応）

## 決定

**embedded-postgres + pgschema を採用する。**

ADR-0001（bun:sqlite）およびADR-0009（sqlite-auto-migrator）を廃止する。

## 根拠

1. **スキーマ進化の自由度**: PostgreSQLはALTER TABLEで任意の変更が可能。schema.sqlを編集するだけで起動時にpgschemaが差分を適用

2. **宣言的スキーマ管理の完成**: sqlite-auto-migratorではSQLiteの制約で宣言的管理が不完全だった。pgschemaでは真に「schema.sqlが唯一の真実の源」

3. **型の正確性**: `TIMESTAMPTZ`によるタイムゾーン明示、`BOOLEAN`ネイティブ型、`bigint`によるCOUNTの正確性

4. **ゼロセットアップの維持**: embedded-postgresが初回起動時にPGバイナリを自動DL。ユーザーは`bun run start:dev`だけで全てが動作

5. **シングルバイナリ配布の見直し**: 当初の「シングルバイナリ配布」要件は、AIエージェント統合やMCPサーバー化が進む中で優先度が下がった。実運用では開発環境でのローカル実行が主なユースケース

## 実装構成

### アーキテクチャ

```
起動フロー:
  EmbeddedPostgresManager.start()   ← PG起動（初回はinitdb）
  → ensurePgSchema(connectionParams) ← pgschemaでschema.sql差分適用
  → new PgDatabase(poolConfig)       ← pg.Pool接続
  → recoverOrphanedProcesses(db)     ← orphan recovery
  → seedDefaultVariants(db)          ← 初期データ投入
  → createContext(db, logger)        ← Repository配線
```

### データディレクトリ

| 用途 | パス |
|------|------|
| PostgreSQLデータ | `~/.auto-kanban/postgres/` |
| pgschemaバイナリ | `~/.auto-kanban/bin/pgschema` |

### DBクライアント

`pg` (node-postgres) を `PgDatabase` クラスでラップ:

```typescript
class PgDatabase {
  queryGet<T>(fragment: SQLFragment): Promise<T | null>
  queryAll<T>(fragment: SQLFragment): Promise<T[]>
  queryRun(fragment: SQLFragment): Promise<{ rowCount: number }>
  close(): Promise<void>
}
```

### Placeholder変換

既存のSQL Builder（`sql` tagged template）は`?`プレースホルダを生成。`PgDatabase`内の`finalize()`関数が`?`→`$1, $2, ...`に自動変換するため、Repositoryコードの変更は不要。

### スキーマ管理

```bash
# schema.sqlを編集するだけ
# → 次回サーバー起動時にpgschemaが差分を検出・適用
```

## 結果

### ポジティブ

- スキーマ変更が自由（ALTER TABLE制限なし）
- migration scriptの管理が不要（schema.sqlが唯一の真実の源）
- ネイティブ型（TIMESTAMPTZ, BOOLEAN）による正確なデータ表現
- Repository interfaceのasync化により将来の拡張性向上

### ネガティブ

- シングルバイナリ配布は不可能
- 初回起動時にネットワーク接続が必要（PG + pgschemaバイナリDL）
- テスト実行にembedded-postgres起動が必要（初回のみ数秒）
- Windowsは非対応（macOS + Linuxのみ）
- Bunのpostinstallスクリプト未実行問題への対処が必要（symlink生成スクリプト）

## 参考資料

- [embedded-postgres (GitHub)](https://github.com/leinelissen/embedded-postgres)
- [pgschema (GitHub)](https://github.com/pgplex/pgschema)
- [pg (node-postgres)](https://node-postgres.com/)
- [ADR-0001: データベースエンジンの選定](./0001-database-selection.md) — 廃止
- [ADR-0009: sqlite-auto-migrator採用](./0009-sqlite-auto-migrator.md) — 廃止
