---
id: "01KPPZWHXPTQ7DDCBCHZ90DK2E"
name: "typescript_is_the_single_language_across_stack"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/tsconfig.json`
- `client/tsconfig.json`
- `package.json` (ルート: `workspaces` に server/client/e2e)
- `bunfig.toml`

## 機能概要

AutoKanban は **TypeScript を唯一のアプリケーション言語**として採用している。
Server / Client / E2E テストすべてが TypeScript で書かれ、ランタイムは **Bun** を使う。
フロントとバックで型を共有するためにコード生成ツールや別ランタイムは一切挟まない。

## 設計意図

AutoKanban は個人利用が主目的の**ローカル専用アプリ**で、次の性質を最大化したい:

- **フロント・バック間での型共有をゼロコストにする**: tRPC に乗せれば、Router で定義した入出力型が
  そのまま client 側から `.useQuery()` / `.useMutation()` の型として見える。`OpenAPI → コード生成`
  のような経路を挟まない
- **単一言語で全部読める**: 個人開発では「読み解くべき言語が 2 つ以上ある」こと自体が
  大きな認知負荷。TypeScript 1 本なら `server/` と `client/` を行き来するコストが小さい
- **配布の単純さ**: Bun は単一バイナリへコンパイルでき、`dist/auto-kanban` だけで配布可能
  （PostgreSQL 移行前提では実際に build している。PG バイナリが必要になった今も Bun 由来の
  シンプルなビルドパイプラインは維持）

性能面の trade-off:

- Rust や Go と比べて CPU bound な処理では劣るが、本アプリの操作は I/O bound
  （DB クエリ、プロセス spawn、SSE ストリーム）が支配的なので実用上の差は出ない
- Bun の JIT と bun:sqlite / pg ドライバは TypeScript 生態系の中では十分速い

## 検討された代替案

- **Rust (Axum + SQLx)**: 性能とメモリ安全性は勝るが、フロントとの型共有に `ts-rs` などの
  コード生成が必要で「書いて動かすサイクル」が長くなる。個人開発では安全性の利得より
  反復速度の損失のほうが大きいと判断
- **Go**: シングルバイナリ出力と短いコンパイル時間は魅力だが、フロントとの型共有が弱く
  GraphQL や OpenAPI を噛ませる手間が発生する
- **Python + FastAPI**: 採用コストは低いが、TypeScript での型共有が取れず距離が遠い

## 主要メンバー

- ランタイム: **Bun** (package manager / runtime / bundler を兼ねる)
- Workspace 構成: ルート `package.json` + `server / client / e2e` の 3 パッケージ
- 型チェック: `bun run check:type` が全パッケージの `tsc --noEmit` を並列実行

## 関連する動作

- [trpc_is_the_client_server_protocol](./trpc_is_the_client_server_protocol.md) — 型共有の具体手段
- [raw_sql_is_used_instead_of_orm](./raw_sql_is_used_instead_of_orm.md) — DB 層も TypeScript で完結
