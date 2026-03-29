# Auto Kanban - プロジェクト概要

## プロジェクトの目的

Auto Kanbanは、AIコーディングエージェント（Claude Code等）を活用したタスク管理アプリケーションです。

以下の方針で設計されています:
- TypeScript統一（フロントエンド・バックエンド）
- Bunランタイムによる高速実行とシングルバイナリ配布
- tRPCによる型安全なAPI

## 技術スタック

### ランタイム

| 技術 | 用途 |
|------|------|
| **Bun** | ランタイム、パッケージマネージャー、バンドラー |

### バックエンド

| 技術 | 用途 |
|------|------|
| **Hono** | Webフレームワーク |
| **tRPC** | 型安全なAPI |
| **PostgreSQL (embedded-postgres)** | データベース |
| **Zod** | バリデーション |

### フロントエンド

| 技術 | 用途 |
|------|------|
| **React 19** | UIライブラリ |
| **Vite** | ビルドツール |
| **Valtio** | ローカル状態管理 |
| **tRPC React Query** | サーバー状態管理 |
| **Tailwind CSS** | スタイリング |

## ディレクトリ構造

```
auto-kanban/
├── docs/
│   ├── adr/                    # Architectural Decision Records
│   │   ├── README.md
│   │   └── 0001-database-selection.md
│   ├── 01-overview.md
│   ├── 02-architecture.md
│   └── ...
├── server/                     # バックエンド
│   ├── src/
│   │   ├── index.ts            # エントリポイント
│   │   ├── presentation/       # Presentation Layer
│   │   │   ├── trpc.ts         # tRPC初期化
│   │   │   ├── context.ts      # コンテキスト
│   │   │   └── routers/        # tRPCルーター
│   │   │       ├── index.ts
│   │   │       ├── project.ts
│   │   │       ├── task.ts
│   │   │       └── workspace.ts
│   │   ├── usecases/           # Usecase Layer
│   │   │   ├── task/
│   │   │   ├── project/
│   │   │   └── workspace/
│   │   ├── repositories/       # Repository Layer（外部との全やり取り）
│   │   │   ├── db.ts
│   │   │   ├── sql.ts
│   │   │   ├── taskRepository.ts
│   │   │   ├── projectRepository.ts
│   │   │   ├── gitRepository.ts
│   │   │   └── executorRepository.ts
│   │   └── models/             # Model Layer
│   │       ├── common.ts
│   │       ├── task.ts
│   │       └── project.ts
│   └── package.json
├── client/                     # フロントエンド
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── lib/
│   │   │   └── trpc.ts
│   │   ├── pages/
│   │   ├── components/
│   │   └── store/
│   ├── index.html
│   └── package.json
├── package.json                # ワークスペース設定
├── bunfig.toml
└── README.md
```

## 主要機能

### 1. プロジェクト管理
- プロジェクトのCRUD
- Gitリポジトリとの関連付け

### 2. タスク管理
- タスクのCRUD
- ステータス管理（todo, inprogress, done, cancelled）

### 3. ワークスペース
- タスクごとの作業環境
- Gitワークツリーによる分離

### 4. エージェント実行
- Claude Code等のAIエージェント実行
- リアルタイムログ表示

### 5. リアルタイム同期
- tRPC Subscriptionsによる即時更新

## 開発コマンド

```bash
# 依存関係インストール
bun install

# 開発サーバー起動
bun run start:dev

# サーバーのみ
cd server && bun run start:dev

# フロントエンドのみ
cd client && bun run start:dev

# データベースマイグレーション
bun run db:migrate

# 本番ビルド
bun run build

# シングルバイナリ生成
bun run build:binary
# → dist/auto-kanban が生成される
```

## 配布

```bash
# ビルド
bun build server/src/index.ts --compile --outfile dist/auto-kanban

# 実行（Bun不要）
./dist/auto-kanban
```

シングルバイナリとして配布可能。ユーザー環境にBunのインストール不要。
