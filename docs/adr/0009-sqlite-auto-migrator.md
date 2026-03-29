# ADR-0009: sqlite-auto-migrator採用

## Status: Superseded

このADRはPostgreSQL (embedded-postgres) への移行に伴い、pgschemaに置き換えられました。pgschemaはschema.sqlの差分を自動検出し、起動時にPostgreSQLスキーマへ適用します。以下は当初の決定記録として残しています。

## ステータス

廃止 (Superseded)

## 日付

2026-02-28

## コンテキスト

Auto Kanbanではbun:sqliteを使用してローカルSQLiteデータベースを管理する（ADR-0001参照）。スキーマの変更を安全かつ効率的に管理するため、マイグレーションツールが必要である。

### 要件

- **宣言的**: DDL SQLファイルで目標スキーマを定義し、差分を自動計算
- **Bun対応**: bun:sqliteとネイティブ連携
- **ライブラリ組み込み**: 外部CLI不要、プログラムから呼び出し可能
- **npm公開**: 安定した依存関係管理

### 検討した選択肢

#### 選択肢1: 逐次マイグレーションファイル

```
migrations/
├── 0001_create_projects.sql
├── 0002_create_tasks.sql
└── 0003_add_description.sql
```

**欠点:**
- マイグレーションファイルの手動管理が必要
- スキーマの全体像が分散

#### 選択肢2: sqldef (CLI)

```bash
sqlite3def ./data.db < schema.sql
```

**利点:**
- 実績あり、安定
- 完全に宣言的

**欠点:**
- 外部バイナリが必要
- 単一バイナリ配布と相性が悪い

#### 選択肢3: sqldef-wasm

```typescript
import sqldef from 'sqldef-wasm';
const migration = await sqldef('sqlite3', desired, current, false);
```

**利点:**
- sqldefの実績あるロジック
- WASMでBun組み込み可能

**欠点:**
- npm未公開（GitHubから直接インストール必要）
- 導入の障壁

#### 選択肢4: sqlite-auto-migrator

```typescript
import { Migrator } from 'sqlite-auto-migrator';
const migrator = new Migrator({ schemaPath, dbPath });
await migrator.make();
await migrator.migrate();
```

**利点:**
- npm公開済み
- Bun対応明記
- 宣言的アプローチ
- ライブラリとして組み込み可能

#### 選択肢5: Atlas / Drizzle

**欠点:**
- Atlas: 外部バイナリ必要
- Drizzle: ORM導入が必要（ADR-0004と矛盾）

## 決定

**sqlite-auto-migratorを採用する。**

## 根拠

1. **npm公開済み**: 安定した依存関係管理が可能。

```bash
bun add sqlite-auto-migrator
```

2. **Bun対応**: bun:sqliteを自動検出し、ネイティブ連携。

> "The library is also compatible with Bun, will use Bun's built-in SQLite library if available"

3. **宣言的スキーマ管理**: DDL SQLファイルで目標スキーマを定義。

```sql
-- schema.sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  repo_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

4. **差分自動検出**: スキーマファイルとDBの差分を自動計算し、マイグレーションを生成。

5. **単一バイナリ配布対応**: `bun build --compile`と互換。

## 結果

### ポジティブ

- スキーマの全体像を1ファイルで管理
- 差分計算の自動化
- 外部バイナリ不要
- Bunとのシームレスな連携

### ネガティブ

- 比較的新しいプロジェクト（成熟度は未知数）
- 複雑なマイグレーション（データ変換等）は別途対応が必要

### 使用パターン

#### プロジェクト構造

```
server/
├── schema.sql           # 目標スキーマ定義
├── migrations/          # 生成されたマイグレーションファイル
│   └── ...
└── src/
    └── db/
        └── migrate.ts   # マイグレーション実行コード
```

#### スキーマ定義

```sql
-- schema.sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  repo_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('todo', 'inprogress', 'inreview', 'done', 'cancelled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_status ON tasks(status);
```

#### マイグレーション実行

```typescript
// src/db/migrate.ts
import { Migrator } from 'sqlite-auto-migrator';
import path from 'path';

export async function runMigrations(dbPath: string) {
  const migrator = new Migrator({
    schemaPath: path.join(import.meta.dir, '../../schema.sql'),
    dbPath,
  });

  // 開発時: マイグレーションファイル生成
  if (process.env.NODE_ENV === 'development') {
    await migrator.make();
  }

  // マイグレーション適用
  await migrator.migrate();
}
```

#### 起動時の呼び出し

```typescript
// src/index.ts
import { Database } from 'bun:sqlite';
import { runMigrations } from './db/migrate';

const DB_PATH = process.env.AUTO_KANBAN_DB_PATH || './data.db';

// マイグレーション実行
await runMigrations(DB_PATH);

// DB接続
const db = new Database(DB_PATH);

// サーバー起動...
```

## 参考資料

- [sqlite-auto-migrator (GitHub)](https://github.com/SanderGi/sqlite-auto-migrator)
- [sqlite-auto-migrator (npm)](https://www.npmjs.com/package/sqlite-auto-migrator)
- [ADR-0001: データベースエンジンの選定](./0001-database-selection.md)
- [ADR-0004: Raw SQL採用](./0004-raw-sql-adoption.md)
