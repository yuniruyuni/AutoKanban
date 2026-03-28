# ADR-0001: データベースエンジンの選定

## ステータス

採用 (Accepted)

## 日付

2026-02-28

## コンテキスト

Auto Kanbanは以下の要件を持つタスク管理アプリケーションである：

- **シングルバイナリ配布**: `bun build --compile`で生成した単一の実行ファイルとして配布
- **ユーザー環境への依存なし**: Bunや外部データベースのインストール不要
- **TypeScript統一**: フロントエンド・バックエンド両方でTypeScript
- **シンプルさ**: 過度な複雑性を避け、必要最小限の機能

データベースエンジンとして以下の選択肢を検討した：

### 選択肢1: bun:sqlite

Bunに組み込まれたSQLiteバインディング。

**利点:**
- Bunに組み込み済み、追加依存なし
- 同期API、シンプルなコードフロー
- `bun build --compile`で完全動作
- better-sqlite3より3-6倍高速（Bun公式主張）

**欠点:**
- SQLite方言（PostgreSQLへの移行時に変換コスト）
- better-sqlite3との一部非互換

### 選択肢2: PGlite (@electric-sql/pglite)

WebAssemblyで実装されたPostgreSQL。

**利点:**
- PostgreSQL互換SQL
- 厳密な型システム
- pgvector等の拡張機能対応
- ブラウザでも動作可能

**欠点:**
- Bunとの互換性問題が報告されている（2025年2月時点）
  - `bun build --compile`でのパス問題
  - ファイルシステム永続化時のinitdbエラー
  - クエリ変数使用時のクラッシュ
- WASMバイナリ（~3MB）を含める必要があり配布サイズ増加
- 比較的新しいプロジェクトで成熟度に懸念

### 選択肢3: embedded-postgres (leinelissen/embedded-postgres)

Zonkyのバイナリを使用してPostgreSQLプロセスを起動。

**利点:**
- 本物のPostgreSQL（WASM変換なし）
- 全拡張機能対応
- 開発/テストと本番で完全一致

**欠点:**
- **シングルバイナリ配布が不可能**（PostgreSQLバイナリ~10MBを別途配布必要）
- 別プロセスとして起動（ポート占有、プロセス管理必要）
- 初回起動時にバイナリダウンロード必要（オフライン配布不可）
- Docker内ではroot実行不可
- ICUライブラリへの依存（Linux環境で問題報告あり）

## 決定

**bun:sqlite を採用する。**

## 根拠

1. **シングルバイナリ配布との整合性**: プロジェクトの主要目標であり、bun:sqliteのみがこれを完全にサポート

2. **安定性**: Bunにネイティブ統合されており、追加依存や互換性問題がない

3. **シンプルさ**: 同期APIでUsecaseパターン（`pre → read → process → write → post → result`）との相性が良い

4. **十分な機能**: Auto Kanbanの要件（タスク・プロジェクト管理）にはSQLiteで十分

5. **リスク回避**: PGliteのBun対応はまだ成熟しておらず、embedded-postgresはアーキテクチャ上不適合

## 結果

### ポジティブ

- 追加の依存関係なしでシングルバイナリ配布が可能
- セットアップ不要で即座に動作
- ファイルベースの永続化でバックアップが容易

### ネガティブ

- 将来PostgreSQLに移行する場合、SQLマイグレーションが必要
- PostgreSQL固有の機能（JSONB演算子、高度なCTE等）は使用不可

### 将来の再検討トリガー

以下の状況が発生した場合、この決定を再検討する：

- PGliteのBun対応が安定した場合
- pgvector等のPostgreSQL拡張が必要になった場合
- 本番環境でPostgreSQLを使用する確定的な計画が立った場合
- ブラウザ側でも同一DBを使いたい要件が出た場合

## 参考資料

- [PGlite公式ドキュメント](https://pglite.dev/docs/about)
- [PGliteベンチマーク](https://pglite.dev/benchmarks)
- [Bun SQLiteドキュメント](https://bun.com/docs/runtime/sqlite)
- [embedded-postgres GitHub](https://github.com/leinelissen/embedded-postgres)
- [PGlite Bun互換性Issue](https://github.com/electric-sql/pglite/issues/414)
