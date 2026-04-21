# AutoKanban

ローカル専用の **AI エージェント付きカンバン・タスク管理アプリ**。
個人開発者が Claude Code / Gemini などの Coding Agent を **複数並行で走らせながら**、
その進捗を **カンバンボード**で俯瞰できるようにする。

- すべて **ローカル動作**（embedded PostgreSQL、認証なし、ネットワーク公開しない）
- 1 タスク = 1 Git worktree で実行が物理的に独立
- Agent との会話・diff・dev server ログをカンバン上で集約
- エージェントは MCP 経由で AutoKanban の文脈を参照できる

## Quick Start

```bash
bun install                  # 依存インストール
bun run start:dev            # server (:3000) + client (:5173)
```

初回起動時に `~/.auto-kanban/postgres/` に埋め込み PostgreSQL が展開されます。対応 OS は macOS と Linux（Windows は非対応）。

ビルド / 配布 / 起動フラグなど運用詳細は [CLAUDE.md](./CLAUDE.md) を参照。

## アーキテクチャ

- **Server**: Bun + Hono + tRPC + embedded PostgreSQL（`pgschema` で起動時自動マイグレーション）
- **Client**: React 19 + Vite + Tailwind + Valtio + tRPC React Query
- **MCP**: AutoKanban 自身が MCP サーバーとして Coding Agent に自動登録される
- **レイヤー**: Model → Repository → Usecase → Presentation の 4 層

仕様・設計判断・ドメインモデルはすべて [`docs/specres/`](./docs/specres/README.md) に集約（specre 形式、single source of truth）。

## ドキュメント

| 入口 | 対象読者 | 内容 |
|---|---|---|
| [`docs/specres/README.md`](./docs/specres/README.md) | 仕様を読みたい人 / エージェント | 全体像 + ドメイン概念カード + アーキテクチャルール + 振る舞いカード |
| [`CLAUDE.md`](./CLAUDE.md) | 開発者 / AutoKanban を開発で使う人 | 開発コマンド、specre ワークフロー、コミット前チェック |
| [`.claude/rules/`](./.claude/rules/) | 実装時 | コーディング規約（server/client パターン、テスト、状態遷移） |

## ライセンス

個人利用向け。ライセンス未定。
