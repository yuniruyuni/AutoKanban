# 運用ガイド

## 概要

Auto Kanbanはローカル専用のデスクトップアプリケーションとして動作する。このドキュメントでは、ビルド、配布、起動、メンテナンスについて説明する。

---

## ビルド

### 開発ビルド

```bash
# 依存関係インストール
bun install

# 開発サーバー起動
bun run dev
```

### プロダクションビルド

```bash
# フロントエンドビルド
cd client
bun run build

# バックエンドビルド（単一バイナリ）
cd server
bun build ./src/index.ts --compile --outfile auto-kanban
```

### クロスプラットフォームビルド

```bash
# macOS (Apple Silicon)
bun build ./src/index.ts --compile --target=bun-darwin-arm64 --outfile auto-kanban-darwin-arm64

# macOS (Intel)
bun build ./src/index.ts --compile --target=bun-darwin-x64 --outfile auto-kanban-darwin-x64

# Linux (x64)
bun build ./src/index.ts --compile --target=bun-linux-x64 --outfile auto-kanban-linux-x64

# Windows (x64)
bun build ./src/index.ts --compile --target=bun-windows-x64 --outfile auto-kanban-windows-x64.exe
```

---

## 配布形態

### 単一バイナリ

```
auto-kanban             # 実行ファイル（全プラットフォーム共通の命名規則）
├── Built-in: Bun runtime
├── Built-in: Server code
├── Built-in: Static files (client)
└── External: data.db   # SQLiteデータベース（実行時に作成）
```

### ディレクトリ構造

```
~/.auto-kanban/
├── data.db             # SQLiteデータベース
├── config.json         # 設定ファイル（オプション）
└── logs/               # ログファイル（オプション）
    └── app.log
```

---

## 起動

### コマンドライン

```bash
# デフォルト起動
./auto-kanban

# ポート指定
./auto-kanban --port 4000

# データディレクトリ指定
./auto-kanban --data-dir /path/to/data

# ヘルプ表示
./auto-kanban --help
```

### 環境変数

| 変数 | デフォルト | 説明 |
|------|-----------|------|
| `AUTO_KANBAN_PORT` | `3000` | サーバーポート |
| `AUTO_KANBAN_DATA_DIR` | `~/.auto-kanban` | データディレクトリ |
| `AUTO_KANBAN_LOG_LEVEL` | `info` | ログレベル |
| `NODE_ENV` | `production` | 環境（development/production） |

### 起動時の処理

```
1. データディレクトリの確認・作成
2. SQLiteデータベースの接続・マイグレーション
3. HTTPサーバー起動（localhost:3000）
4. WebSocketサーバー起動（localhost:3001）
5. ブラウザを開く（オプション）
```

---

## データベース管理

### マイグレーション

```typescript
// src/migrations/index.ts
export const migrations = [
  {
    version: 1,
    up: (db: Database) => {
      db.run(`
        CREATE TABLE projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          repo_path TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      db.run(`
        CREATE TABLE tasks (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id)
        )
      `);
    },
  },
  // 将来のマイグレーション
];
```

### バックアップ

```bash
# SQLiteファイルのコピー
cp ~/.auto-kanban/data.db ~/.auto-kanban/data.db.backup

# 日付付きバックアップ
cp ~/.auto-kanban/data.db ~/.auto-kanban/data.db.$(date +%Y%m%d)
```

### リストア

```bash
# アプリケーションを停止してからリストア
./auto-kanban stop
cp ~/.auto-kanban/data.db.backup ~/.auto-kanban/data.db
./auto-kanban
```

---

## ログ

### ログレベル

| レベル | 説明 |
|-------|------|
| `error` | エラーのみ |
| `warn` | 警告以上 |
| `info` | 通常運用情報 |
| `debug` | デバッグ情報 |

### ログ出力

```typescript
// src/logger.ts
import { createLogger } from './utils/logger';

export const logger = createLogger({
  level: process.env.AUTO_KANBAN_LOG_LEVEL || 'info',
});

// 使用例
logger.info('Server started', { port: 3000 });
logger.error('Database error', { error: err.message });
```

### ログファイル

```bash
# 最新のログを表示
tail -f ~/.auto-kanban/logs/app.log

# エラーのみフィルタ
grep '"level":"error"' ~/.auto-kanban/logs/app.log
```

---

## ヘルスチェック

### エンドポイント

```
GET /health

Response:
{
  "status": "ok",
  "version": "1.0.0",
  "database": "connected",
  "uptime": 3600
}
```

### ヘルスチェックの実装

```typescript
// presentation/routes/health.ts
app.get('/health', (c) => {
  const dbStatus = checkDatabase();
  const uptime = process.uptime();

  return c.json({
    status: dbStatus ? 'ok' : 'error',
    version: process.env.npm_package_version,
    database: dbStatus ? 'connected' : 'disconnected',
    uptime: Math.floor(uptime),
  });
});
```

---

## トラブルシューティング

### よくある問題

#### ポートが使用中

```
Error: listen EADDRINUSE: address already in use :::3000

解決策:
1. 他のプロセスを終了
   lsof -i :3000
   kill -9 <PID>

2. 別のポートを使用
   ./auto-kanban --port 4000
```

#### データベースがロック

```
Error: SQLITE_BUSY: database is locked

解決策:
1. 他のアプリケーションがDBを使用していないか確認
2. アプリケーションを再起動
3. 最悪の場合、ロックファイルを削除
   rm ~/.auto-kanban/data.db-journal
```

#### マイグレーション失敗

```
Error: Migration failed at version 2

解決策:
1. バックアップから復元
2. マイグレーションスクリプトを修正
3. 再度マイグレーション実行
```

### デバッグモード

```bash
# デバッグログを有効化
AUTO_KANBAN_LOG_LEVEL=debug ./auto-kanban

# 開発モード
NODE_ENV=development ./auto-kanban
```

---

## アップデート

### バージョン確認

```bash
./auto-kanban --version
```

### アップデート手順

```bash
# 1. 現在のバージョンをバックアップ
cp ./auto-kanban ./auto-kanban.old
cp ~/.auto-kanban/data.db ~/.auto-kanban/data.db.backup

# 2. 新しいバイナリをダウンロード
curl -L https://github.com/user/auto-kanban/releases/latest/download/auto-kanban -o auto-kanban

# 3. 実行権限を付与
chmod +x auto-kanban

# 4. 起動（マイグレーションは自動実行）
./auto-kanban
```

---

## セキュリティ運用

### 定期タスク

| タスク | 頻度 | 説明 |
|-------|------|------|
| 依存関係更新 | 月次 | `bun update` |
| 脆弱性チェック | 週次 | `bun audit` |
| バックアップ | 日次/週次 | DBファイルのコピー |
| ログローテーション | 週次 | 古いログの削除 |

### ログローテーション

```bash
# crontabに追加
0 0 * * 0 find ~/.auto-kanban/logs -name "*.log" -mtime +30 -delete
```

---

## パフォーマンス

### リソース使用量

| リソース | 目安 |
|---------|------|
| メモリ | ~100MB |
| CPU | 最小（アイドル時はほぼ0%） |
| ディスク | データ量依存（初期~10MB） |

### パフォーマンス監視

```typescript
// 起動時のメトリクス
logger.info('Server started', {
  memoryUsage: process.memoryUsage(),
  cpuUsage: process.cpuUsage(),
});

// 定期的なメトリクス出力（開発時のみ）
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    logger.debug('Metrics', {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
    });
  }, 60000);
}
```

---

## 開発環境

### 必要なツール

| ツール | バージョン | 用途 |
|-------|-----------|------|
| Bun | 1.0+ | ランタイム・パッケージマネージャ |
| Git | 2.0+ | バージョン管理 |
| Node.js | 18+ | 一部ツールの互換性用（オプション） |

### セットアップ

```bash
# リポジトリクローン
git clone https://github.com/user/auto-kanban.git
cd auto-kanban

# 依存関係インストール
bun install

# 開発サーバー起動
bun run dev

# テスト実行
bun test

# リント
bun run lint
```

### ディレクトリ構成

```
auto-kanban/
├── client/                # フロントエンド（React）
│   ├── src/
│   ├── index.html
│   └── package.json
├── server/                # バックエンド（Bun + Hono）
│   ├── src/
│   └── package.json
├── docs/                  # ドキュメント
├── bun.lockb
└── package.json           # ルートパッケージ（ワークスペース）
```

---

## CI/CD

### GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test
      - run: bun run lint

  build:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run build
```

### リリース

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        target:
          - bun-darwin-arm64
          - bun-darwin-x64
          - bun-linux-x64
          - bun-windows-x64
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun build ./server/src/index.ts --compile --target=${{ matrix.target }} --outfile auto-kanban-${{ matrix.target }}
      - uses: softprops/action-gh-release@v1
        with:
          files: auto-kanban-*
```

