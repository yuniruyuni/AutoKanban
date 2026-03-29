# Auto Kanban

ローカル専用AIエージェント＋タスク管理アプリ（カンバンボード）。
TypeScriptフルスタックモノレポ、Bunランタイム。
サーバー: Hono + tRPC + PostgreSQL(embedded-postgres + pgschema)、クライアント: React 19 + Vite + Tailwind + Valtio。

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

## コミット前チェック

`git commit` 実行時、PreToolUse hookがlint・typecheck・テスト・arch:checkを**自動実行**する。失敗時はエラー出力と共にコミットがブロックされるので、エラーを修正して再コミットすること。フォーマットはPostToolUse hookでWrite/Edit時に自動実行される。
