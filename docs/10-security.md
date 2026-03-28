# セキュリティガイドライン

## 概要

Auto Kanbanは**ローカル専用の個人利用アプリケーション**であり、マルチユーザー認証やネットワーク越しのアクセスを想定していない。このため、一般的なWebアプリケーションとは異なるセキュリティモデルを採用する。

---

## セキュリティモデル

### 前提条件

```
┌─────────────────────────────────────────────────┐
│              ローカルマシン                       │
│  ┌─────────────────────────────────────────┐   │
│  │           Auto Kanban                    │   │
│  │  ┌─────────┐    ┌─────────────────┐    │   │
│  │  │ Frontend │◄──►│ Backend Server  │    │   │
│  │  │ (React)  │    │ (localhost:3000)│    │   │
│  │  └─────────┘    └────────┬────────┘    │   │
│  │                          │              │   │
│  │                   ┌──────▼──────┐      │   │
│  │                   │ SQLite DB    │      │   │
│  │                   │ (file)       │      │   │
│  │                   └─────────────┘      │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ユーザー = OSユーザー = 唯一の利用者            │
└─────────────────────────────────────────────────┘
```

### セキュリティ境界

| レベル | 境界 | 保護対象 |
|-------|------|---------|
| OS | ファイルシステム権限 | SQLiteデータベースファイル |
| プロセス | localhost binding | 外部ネットワークからのアクセス |
| アプリ | 入力バリデーション | SQLインジェクション等 |

---

## 認証・認可

### 方針

**認証・認可は実装しない**

理由:
1. ローカル専用アプリケーション
2. OSユーザー = アプリケーションユーザー
3. 単一ユーザーのため権限分離不要

### 将来の拡張

マルチユーザー対応が必要になった場合のみ検討:
- セッションベース認証
- JWTトークン
- OAuth連携

---

## 入力バリデーション

### tRPC + Zodによるバリデーション

全ての入力はZodスキーマで検証する。

```typescript
// presentation/routers/task.ts
import { z } from 'zod';

const createTaskInput = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(10000).nullable(),
});

export const taskRouter = router({
  create: publicProcedure
    .input(createTaskInput)
    .mutation(({ input, ctx }) => {
      return createTask(input).run(ctx);
    }),
});
```

### バリデーションルール

| フィールド | ルール |
|-----------|--------|
| ID | UUID形式 |
| タイトル | 1-200文字 |
| 説明 | 0-10000文字 |
| ステータス | enum値のみ |
| 日付 | ISO 8601形式 |

### サニタイズ

- HTMLエスケープ: React側で自動（JSX）
- SQLエスケープ: プリペアドステートメント使用

---

## SQLインジェクション対策

### 方針

**全てのSQLクエリでプリペアドステートメントを使用**

```typescript
// 良い例: プリペアドステートメント
db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);

// 悪い例: 文字列結合（禁止）
db.prepare(`SELECT * FROM tasks WHERE id = '${taskId}'`).get();
```

### Specification Patternとの統合

```typescript
// repositories/common.ts
function specToSQL(spec: Task.Spec): { sql: string; params: unknown[] } {
  switch (spec.type) {
    case 'ById':
      return { sql: 'id = ?', params: [spec.id] };
    case 'ByProject':
      return { sql: 'project_id = ?', params: [spec.projectId] };
    case 'ByStatuses':
      const placeholders = spec.statuses.map(() => '?').join(', ');
      return { sql: `status IN (${placeholders})`, params: spec.statuses };
  }
}
```

### レビューチェックリスト

- [ ] 全てのDB操作がプリペアドステートメントを使用
- [ ] 動的テーブル名・カラム名はホワイトリスト検証
- [ ] ユーザー入力が直接SQL文字列に含まれていない

---

## コマンドインジェクション対策

### Gitコマンド実行

Auto KanbanはGit操作を行うため、コマンド実行時の安全性を確保する。

```typescript
// 良い例: 配列でコマンド引数を渡す
import { spawn } from 'bun';

const proc = spawn(['git', 'commit', '-m', message], {
  cwd: repoPath,
});

// 悪い例: シェル経由（禁止）
import { exec } from 'child_process';
exec(`git commit -m "${message}"`);  // シェルインジェクションの危険
```

### 安全なコマンド実行パターン

```typescript
// usecases/git/commit.ts
export const gitCommit = (repoPath: string, message: string) => usecase({
  pre: async (ctx) => {
    // パス検証
    if (!isValidRepoPath(repoPath)) {
      return fail('INVALID_PATH', 'Invalid repository path');
    }
    // メッセージ長制限
    if (message.length > 10000) {
      return fail('MESSAGE_TOO_LONG', 'Commit message too long');
    }
    return { repoPath, message };
  },
  write: async (ctx, { repoPath, message }) => {
    const result = await spawn(['git', 'commit', '-m', message], {
      cwd: repoPath,
    });
    return result;
  },
});
```

---

## ファイルシステムセキュリティ

### データベースファイル

```typescript
// 推奨配置
const DB_PATH = path.join(os.homedir(), '.auto-kanban', 'data.db');

// ディレクトリ作成時に権限設定
await mkdir(path.dirname(DB_PATH), { mode: 0o700, recursive: true });
```

### パストラバーサル対策

```typescript
// repositories/git-repository.ts
function validateRepoPath(repoPath: string, basePath: string): boolean {
  const resolved = path.resolve(repoPath);
  const base = path.resolve(basePath);

  // ベースパス外へのアクセスを禁止
  return resolved.startsWith(base + path.sep);
}
```

---

## ネットワークセキュリティ

### localhost限定

```typescript
// server/index.ts
const server = Bun.serve({
  hostname: '127.0.0.1',  // localhostのみ
  port: 3000,
  fetch: app.fetch,
});
```

### CORS設定

```typescript
// 同一オリジンのみ許可
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));
```

### WebSocket

```typescript
// tRPC WebSocket（localhost限定）
const wss = new WebSocketServer({
  host: '127.0.0.1',
  port: 3001,
});
```

---

## 依存関係のセキュリティ

### 定期的な更新

```bash
# 脆弱性チェック
bun audit

# 依存関係更新
bun update
```

### 最小限の依存

- 必要最小限のパッケージのみ使用
- 大きなフレームワークより小さなライブラリを優先
- 定期的な依存関係の棚卸し

---

## エラーハンドリングとログ

### センシティブ情報の保護

```typescript
// 良い例: 汎用エラーメッセージ
return fail('DB_ERROR', 'Database operation failed');

// 悪い例: 詳細なエラー情報（避ける）
return fail('DB_ERROR', `SQL error: ${error.message} at line ${error.line}`);
```

### ログ出力

```typescript
// ローカルアプリのため、ログは最小限
// 本番環境では詳細ログを出力しない

if (process.env.NODE_ENV === 'development') {
  console.log('Debug info:', debugData);
}
```

---

## セキュリティチェックリスト

### 開発時

- [ ] 新規SQLクエリはプリペアドステートメントを使用
- [ ] 外部コマンド実行は配列形式で引数を渡す
- [ ] ユーザー入力はZodで検証
- [ ] ファイルパスはベースパス内か検証

### リリース前

- [ ] `bun audit`で脆弱性チェック
- [ ] 依存関係のバージョン確認
- [ ] localhostバインディングの確認
- [ ] 開発用ログの無効化

### 定期メンテナンス

- [ ] 月次の依存関係更新
- [ ] セキュリティアドバイザリの確認
- [ ] コードの棚卸し

---

## リスク評価

### 低リスク（ローカル専用のため）

| 脅威 | 理由 |
|-----|------|
| 認証バイパス | 認証なし（設計通り） |
| セッションハイジャック | セッション管理なし |
| CSRF | ローカル通信のみ |
| ネットワーク傍受 | localhost通信 |

### 対策必要

| 脅威 | 対策 |
|-----|------|
| SQLインジェクション | プリペアドステートメント |
| コマンドインジェクション | 配列形式の引数渡し |
| パストラバーサル | ベースパス検証 |
| 依存関係の脆弱性 | 定期的な更新 |

