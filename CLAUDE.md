# Auto Kanban

ローカル専用AIエージェント＋タスク管理アプリ（カンバンボード）。
TypeScriptフルスタックモノレポ、Bunランタイム。
サーバー: Hono + tRPC + PostgreSQL(embedded-postgres + pgschema)、クライアント: React 19 + Vite + Tailwind + Valtio。

## 開発コマンド

```bash
bun install                        # 依存インストール（ルート）
bun run start:dev                  # server+client同時起動
cd server && bun run start:dev     # サーバーのみ（port 3000, --watch）
cd client && bun run start:dev     # クライアントのみ（port 5173, /trpc をサーバーへproxy）
bun run check:lint                 # lint（全パッケージ）
bun run check:type                 # 型チェック（全パッケージ）
bun run check:test                 # テスト（全パッケージ）
bun run check:arch                 # アーキテクチャ依存関係チェック（全パッケージ）
```

## コミット前チェック

`git commit` 実行時、PreToolUse hookがcheck:lint・check:type・check:test・check:archを**自動実行**する。失敗時はエラー出力と共にコミットがブロックされるので、エラーを修正して再コミットすること。フォーマットはPostToolUse hookでWrite/Edit時に自動実行される。
