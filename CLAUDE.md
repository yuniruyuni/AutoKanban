# Auto Kanban

ローカル専用AIエージェント＋タスク管理アプリ（カンバンボード）。
TypeScriptフルスタックモノレポ、Bunランタイム。
サーバー: Hono + tRPC + PostgreSQL(embedded-postgres + pgschema)、クライアント: React 19 + Vite + Tailwind + Valtio。

## 仕様の Single Source of Truth

実装を触る前に **specre カード** (`docs/specres/`) を読む:

- **`docs/specres/README.md`** — システム全体の入口（何者か / アーキ / ドメインマップ / 概念一覧）
- **ドメイン概念**: `docs/specres/<domain>/xxx_is_yyy.md` — Project / Task / Workspace / Session / Approval など
- **アーキテクチャルール**: `docs/specres/architecture/*.md` — tRPC / Raw SQL / レイヤー / Usecase 6 ステップなど
- **振る舞い仕様**: `docs/specres/<domain>/<subject>_<verb>.md` — 各動作 1 ファイル
- **実装規約**: `.claude/rules/*.md` — コーディング標準（specre の補完）

### specre の典型ワークフロー

ソース側に `// @specre <ULID>` マーカーがあり、カードと双方向リンクしている。

```bash
# 実装ファイルから仕様を引く
specre trace server/src/usecases/task/create-task.ts

# 仕様から実装を引く
specre trace 01KPNSHJW0CXD6X1YSAFEWHKXP

# キーワードで検索
specre search "queue-message"

# カードの一覧・ステータス集計
specre status

# drift / orphan / index の健全性
bun run check:specre
```

### 新規 Usecase / 機能を追加する PR

1. 対応するドメインディレクトリを決める（なければ新設）
2. `specre new docs/specres/<domain> --name <subject_verb>` でカードを作る
3. 関連ファイル / 機能概要 / 設計意図 / シナリオ / 失敗例外 を記述
4. 実装の export 関数または procedure の直上に `// @specre <ULID>` マーカーを付ける
5. `bun run specre:index` で index を更新
6. Usecase / 概念が絡む PR では **実装と specre を同じコミットに含める**

`specre` CLI は Rust 製 (`cargo install specre`)。未インストール環境でも `bun run check` は
pass するよう `check:specre` は CLI 有無を検知して skip する。

## 開発コマンド

```bash
bun install                        # 依存インストール（ルート）
bun run start:dev                  # server+client同時起動
cd server && bun run start:dev     # サーバーのみ（port 3000, --watch）
cd client && bun run start:dev     # クライアントのみ（port 5173, /trpc をサーバーへproxy）
bun run check                      # 全チェック一括並行実行
bun run check:lint                 # lint（全パッケージ）
bun run check:type                 # 型チェック（全パッケージ）
bun run check:test                 # テスト（全パッケージ）
bun run check:arch                 # アーキテクチャ依存関係チェック（全パッケージ）
bun run check:specre               # specre health-check（CLI未導入時は skip）
bun run specre:index               # specre index.json / _INDEX.md を再生成
bun run specre:status              # specre カードの status 集計
bun run fix:lint                   # lint自動修正（全パッケージ）
bun run watch                      # 全watchモード一括起動
bun run watch:arch                 # アーキテクチャチェックwatch（全パッケージ）
bun run watch:lint                 # lintwatch（全パッケージ）
bun run watch:test                 # テストwatch（全パッケージ）
bun run watch:type                 # 型チェックwatch（全パッケージ）
```

## コミット前チェック

`git commit` 実行時、PreToolUse hookがcheck:lint・check:type・check:test・check:archを**自動実行**する。失敗時はエラー出力と共にコミットがブロックされるので、エラーを修正して再コミットすること。フォーマットはPostToolUse hookでWrite/Edit時に自動実行される。

### specre 用 git pre-commit hook

`.githooks/pre-commit` が `docs/specres/**/*.md` のステージ変更を検知して、自動的に `specre index` を走らせ `index.json` / `_INDEX.md` を再生成し、commit に含める。

初回 clone 時は `bun install` が `prepare` スクリプト経由で `git config --local core.hooksPath .githooks` を自動実行する。手動で有効化する場合は `bun run setup:hooks`。specre CLI 未導入環境では hook が silent skip する。
