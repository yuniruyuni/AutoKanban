# Auto Kanban

ローカル専用AIエージェント＋タスク管理アプリ（カンバンボード）。
TypeScriptフルスタックモノレポ、Bunランタイム。
サーバー: Hono + tRPC + SQLite(bun:sqlite)、クライアント: React 19 + Vite + Tailwind + Valtio。

## 開発コマンド

```bash
bun install                        # 依存インストール（ルート）
bun run dev                        # server+client同時起動
cd server && bun run dev           # サーバーのみ（port 3000, --watch）
cd client && bun run dev           # クライアントのみ（port 5173, /trpc をサーバーへproxy）
cd server && bun test              # サーバーテスト（bun test）
cd client && bun run test          # クライアントテスト（vitest）
bun run typecheck                  # 全パッケージ型チェック
bun run arch:check                 # アーキテクチャ依存関係チェック（server）
```

## アーキテクチャ（4層）

Model → Repository → Usecase → Presentation

- レイヤー間データは **Model型のみ**（DTOなし）
- **Usecase間の相互呼び出し禁止**
- Repository interface: `server/src/types/repository.ts`
- Context定義: `server/src/types/context.ts`（step別Context型: PreContext, ReadContext, ProcessContext, WriteContext, PostContext）
- 補助ディレクトリ: `lib/`（純粋関数ユーティリティ）、`setup/`（起動時初期化）、`mcp/`（MCPサーバー実装）、`db/`（DB初期化・マイグレーション）

## コーディング規約

- ID生成: `generateId()` (`crypto.randomUUID()`) — `server/src/models/common.ts`
- 日時: Model内は `Date` 型、DB格納時は `dateToSQL()` / `dateFromSQL()` — `server/src/repositories/common.ts`
- SQLカラム: snake_case / TypeScript: camelCase
- Repository標準メソッド: `get(spec)`, `list(spec, cursor)`, `upsert(entity)`, `delete(spec)`
- DB操作は **upsert** (`INSERT ... ON CONFLICT DO UPDATE`)
- クライアントimport: `@/` エイリアス = `client/src/`
- Schema変更: `server/schema.sql` 編集 → dev起動時に自動マイグレーション（sqlite-auto-migrator）

## ルールファイル

`.claude/rules/` にパス指定付きのコンテキストルールを配置。該当パスのファイル編集時に自動ロードされる。

## ドキュメント参照

- `docs/02-architecture.md` — レイヤードアーキテクチャ全体像
- `docs/05-backend.md` — バックエンド詳細
- `docs/14-chat-interface.md` — チャットUI・承認システム
- `docs/15-task-state-transitions.md` — タスク状態遷移
- `docs/adr/` — 9つのADR（DB選定、tRPC採用、Specification Pattern等）
