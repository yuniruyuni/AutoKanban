# 設計方針

## 概要

本プロジェクト（Auto Kanban）は、個人利用向けのAIエージェント統合タスク管理アプリケーションです。

本ドキュメントでは、技術スタックの選定理由と設計上のポイントを説明します。

## 技術スタック

| 項目 | 採用技術 | 理由 |
|------|----------|------|
| バックエンド言語 | **TypeScript** | 開発速度向上、フロントとの言語統一 |
| ランタイム | **Bun** | 高速実行、シングルバイナリ |
| Webフレームワーク | **Hono** | 軽量、Bun最適化 |
| API | **tRPC** | 型安全、コード生成不要 |
| DB操作 | **SQL Builder + bun:sqlite** | 安全な合成、高速、柔軟 |
| 状態管理 | **Valtio** | ミュータブル操作、ボイラープレート削減 |
| アーキテクチャ | **レイヤードアーキテクチャ** | 責務分離、テスト容易性 |

---

## アーキテクチャ

```
┌─────────────────────────────────────────┐
│           Frontend (React)              │
│       Valtio + tRPC React Query         │
└────────────────┬────────────────────────┘
                 │ tRPC (HTTP/WebSocket)
┌────────────────┼────────────────────────┐
│           Backend (Bun)                 │
│  ┌──────────────────────────────────┐  │
│  │      Presentation (routers/)      │  │
│  │          tRPC handlers            │  │
│  └──────────────┬───────────────────┘  │
│  ┌──────────────┼───────────────────┐  │
│  │       Usecase (usecases/)         │  │
│  │      Business Logic               │  │
│  └──────────────┬───────────────────┘  │
│  ┌──────────────┼───────────────────┐  │
│  │    Repository (repositories/)     │  │
│  │  TableAccess + Specification      │  │
│  └──────────────┬───────────────────┘  │
│  ┌──────────────┴───────────────────┐  │
│  │       Model (models/)             │  │
│  │    Domain Models                  │  │
│  └──────────────────────────────────┘  │
│         2 packages (server, web)        │
└─────────────────────────────────────────┘
```

---

## 機能分類

### 必須機能（実装済み）

| 機能 | 説明 |
|------|------|
| プロジェクト管理 | プロジェクトのCRUD |
| タスク管理 | タスクのCRUD、ステータス管理 |
| ワークスペース | 作業環境の作成・管理 |
| セッション | エージェント実行単位 |
| 実行管理 | プロセス実行・ログ表示 |
| 設定 | 基本設定の管理 |

### オプション機能（後から追加可能）

| 機能 | 説明 | 追加の難易度 |
|------|------|-------------|
| マルチリポジトリ | 複数リポジトリ対応 | 中 |
| PR作成 | GitHub PR連携 | 中 |
| タグ | タスクのタグ付け | 低 |
| 差分表示 | リッチな差分ビュー | 中 |
| 画像添付 | タスクへの画像添付 | 中 |

### スコープ外とした機能

| 機能 | 理由 |
|------|------|
| 組織機能 | 個人利用では不要 |
| リモートデプロイ | ローカル利用のみ |
| 分析/テレメトリ | プライバシー重視 |
| OAuth連携 | シンプル化 |
| 承認フロー（組織向け多段承認） | 個人利用では過剰。ただしAIエージェントのPermission承認・Plan承認はチャットUI内で実装（14-chat-interface.md参照） |
| ターミナル | 外部ターミナル使用 |
| コマンドバー | マウス操作で十分 |

---

## 設計上のポイント

### 1. レイヤードアーキテクチャ

4層構造で責務を明確に分離。**全レイヤー間のデータはModel型で受け渡し。**

![レイヤードアーキテクチャ](./assets/layered-architecture.svg)

**設計原則:**
- 全レイヤー間はModel型でデータ受け渡し
- Usecaseは独自のDTO等を定義しない
- Usecaseはステップベース設計（pre → read → process → write → post → result）
- ビジネスロジックはModelのメソッド/関数として実装
- DB行↔Model変換はRepository内部でのみ発生
- 1 Model = 1 Repository（各Modelに対応するRepositoryが1つ）
- RepositoryはSQLを直接使用（JOINなど複雑なクエリに対応）
- SpecificationはModel層でnamespace内に定義（`models/xxx.ts`の`Xxx.Spec`）
- 使用側で`Comp<Xxx.Spec>`として`and`/`or`/`not`を付与

**外部とのやり取りの方向性:**
| レイヤー | 方向 | 説明 |
|---------|------|------|
| Presentation | 受動的 | 外部からのリクエストを受信し、応答を返す |
| Repository | 能動的 | 外部システム（DB、Git、コマンド等）を能動的に呼び出す |

**Repository標準メソッド（DBアクセス時）:**
- `list(spec, cursor): Page<Model>` - カーソルベース一覧取得（cursorにはソート条件を含む）
- `get(spec): Model | null` - 1件取得
- `upsert(model): void` - 挿入または更新
- `delete(spec): void` - 削除
- `count(spec): number` - 件数取得

**ソート可能フィールドの制約:**
- 各ModelはSortKey型でソート可能なフィールドを制約
- インデックス済みフィールドに限定しパフォーマンスを保証
- Model.cursor()で自身のカーソル位置を返却

**利点:**
- 責務の明確な分離
- テストの容易性
- 保守性の向上
- 依存関係の一方向性
- Model型による共通言語の強制
- SQL直接使用で柔軟なクエリ構築
- ステップベースUsecaseで`let`/`!`を完全排除

### 2. SQL + Specification Pattern

ORMを使わず、SQLで安全かつ柔軟にクエリを構築。

```typescript
// SQL: SQL文字列とパラメータをカプセル化するイミュータブルオブジェクト
const query = sql`
  SELECT * FROM tasks WHERE project_id = ${projectId} AND status = ${status}
`;
// sql: "SELECT * FROM tasks WHERE project_id = ? AND status = ?"
// params: [projectId, status]

// Model層: defineSpecsで関数定義、SpecsOfで型を自動導出
import { defineSpecs, type SpecsOf, and } from './common';

export const Task = defineSpecs({
  ById: (id: string) => ({ id }),
  ByProject: (projectId: string) => ({ projectId }),
  ByStatuses: (...statuses: Task.Status[]) => ({ statuses }),
});

export namespace Task {
  export type Status = 'todo' | 'inprogress' | 'inreview' | 'done' | 'cancelled';
  export type Spec = SpecsOf<typeof Task>;
}

// Repository/Usecase層: ヘルパー関数で直感的に合成
const spec = and(Task.ByProject(projectId), Task.ByStatuses('todo', 'inprogress'));

// compToSQL: and/or/not処理を共通化（Repository層）
const where = compToSQL(spec, taskSpecToSQL);
```

**利点:**
- bun:sqliteの高速性を最大限活用
- SQLインジェクション防止（プレースホルダ強制）
- イミュータブルな設計で予測可能な動作
- Tagged Template Literalで直感的なSQL記述
- `defineSpecs`で型とヘルパー関数を同時定義
- `SpecsOf<T>`で型を自動導出（重複定義不要）
- `and`/`or`/`not`ヘルパーで直感的な条件合成
- `compToSQL`でand/or/not処理を共通化（DRY原則）
- 学習コスト削減（SQLの知識がそのまま活用）

### 3. ステップベースUsecase

全usecaseは6ステップ（pre, read, process, write, post, result）で構成。**全ステップ非同期・省略可能**。引数はクロージャで渡す。**1 usecase = 1 transaction**が保証される。

```typescript
// usecases/task/list-tasks.ts - 最もシンプルなパターン
export const listTasks = (projectId: string) => usecase({
  read: async (ctx, _) => await ctx.repos.task.list(Task.ByProject(projectId)),
  // result省略 → readの戻り値がそのまま結果になる
});

// usecases/task/create-task.ts - fail() でエラーを返すパターン
export const createTask = (task: Task) => usecase({
  read: async (ctx, _) => {
    const project = await ctx.repos.project.get(Project.ById(task.projectId));
    if (!project) return fail('NOT_FOUND', 'Project not found');
    return { project };
  },
  write: async (ctx, state) => {
    // state は { project: Project }（Fail は自動除外）
    await ctx.repos.task.upsert(task);
    return state;
  },
  result: async () => task,
});
```

**状態の流れ:**
```
(引数) ─closure─→ pre ─→ Promise<TPre> ─read─→ Promise<TRead> ─process─→ Promise<TProcess> ─write─→ Promise<TWrite> ─post─→ Promise<TPost> ─result─→ Promise<TOutput>
                   ↑                  └─────────────────────────────────────────────────────────┘                     ↑              ↑
                 省略可                                         トランザクション内                                    省略可        省略可
                   └──────────────────────────────────────────────────────────────────────────────────────────────────┘            (=TPost)
                                                            トランザクション外
```

**利点:**
- 全ステップが非同期（`Promise<T>`を返す）
- `pre`は`(ctx) => Promise<state>`、他は`(ctx, state) => Promise<newState | Fail>`
- `BaseContext`で`now`（呼び出し時点固定）と`logger`を全ステップに提供
- 各ステップの型が自動推論される（Fail は `Unfail<T>` で自動除外）
- 全ステップオプショナルで最小限のコード
- `throw` 不要、`return fail()` で自然なエラーハンドリング（後続ステップはスキップ）
- `let`変数と型アサーション`!`を完全排除
- **1 usecase = 1 transaction**: read → process → write はトランザクション内で実行
- **usecase間呼び出し禁止**: 共通処理はModelにメソッドを追加
- ロギング（pre/post）とビジネスロジック（read/process/write）の明確な分離

### 4. TypeScript統一

フロント・バックで同じ言語を使用。

```typescript
// バックエンドで定義した型がフロントエンドで自動利用可能
// バックエンド
export const taskRouter = router({
  list: publicProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      status: TaskStatusSchema.optional(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(({ ctx, input }) => listTasks(input).run(ctx)),
});

// フロントエンド（型推論で Result<Page<Task>, Fail> が得られる）
const { data } = trpc.task.list.useQuery({
  projectId,
  limit: 50,
});
```

### 5. tRPCによる型安全API

```typescript
// Presentation Layer
export const taskRouter = router({
  create: publicProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      title: z.string().min(1),
      description: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => createTask(input).run(ctx)),
});
```

**利点:**
- 型定義ファイル不要
- コード生成不要
- IDE補完が効く
- リファクタリングが安全
- Result型でビジネスエラーとシステムエラーを明確に区別

### 6. Valtioの採用

```typescript
// 直接代入でOK
taskState.tasks = newTasks;

// vs Zustand
set({ tasks: newTasks });
```

**利点:**
- ミュータブルな操作
- ボイラープレート最小
- WebSocket更新との相性

### 7. Bunランタイム

```bash
# シングルバイナリ生成
bun build --compile --outfile dist/auto-kanban

# 実行（Bunのインストール不要）
./dist/auto-kanban
```

**利点:**
- 高速な起動・実行
- ビルトインSQLite
- シングルバイナリ生成
- パッケージマネージャ統合

---

## 段階的な機能追加

### Phase 1: MVP（現在）

- プロジェクト・タスクCRUD
- ワークスペース作成・管理
- Claude Code実行
- ログ表示

### Phase 2: 基本機能追加

- Git差分表示
- セットアップ/クリーンアップスクリプト
- 複数セッション対応
- 設定ページ

### Phase 3: 便利機能追加

- マルチリポジトリ
- 追加エージェント対応
- タグ機能
- PR作成機能

---

## 開発・デプロイ

### 開発

```bash
# 依存関係インストール
bun install

# 開発サーバー起動（両方同時）
bun run start:dev
```

### ビルド・配布

```bash
# フロントエンドビルド
cd client && bun run build

# シングルバイナリ生成
bun build server/src/index.ts \
  --compile \
  --outfile dist/auto-kanban

# 配布（1ファイル）
./dist/auto-kanban
```

---

## 今後の拡張ポイント

### 容易に追加できる機能

1. **追加エージェント対応**
   - `ExecutorRepository`に設定追加のみ

2. **タグ機能**
   - `schema.sql`に`tags`テーブル追加
   - `TagRepository`作成
   - tRPCルーター追加

3. **PR作成**
   - `GitRepository`に`createPullRequest`メソッド追加
   - UIにボタン追加

### 設計時の考慮

- **レイヤー分離**: 各層の責務が明確
- **Repository抽象化**: 外部システムの差し替えが容易
- **SQL Builder**: クエリ文字列とパラメータの安全な合成
- **Specification Pattern**: クエリ条件の再利用
- **設定ファイル**: JSON形式で拡張可能

---

## まとめ

Auto Kanbanは、個人利用に最適化された設計を採用しています：

1. **技術スタックの統一**: TypeScript (Bun) によるフルスタック開発
2. **アーキテクチャの明確化**: レイヤードアーキテクチャ
3. **ステップベースUsecase**: 全ステップ非同期・オプショナル、1 usecase = 1 transaction、`let`/`!`を完全排除、型推論で安全
4. **安全なDB操作**: SQL + Specification Pattern
5. **型システムの活用**: tRPC + Model Layer + Result型
6. **ランタイムの最適化**: Bun
7. **機能の厳選**: 必須機能のみ
8. **配布の簡素化**: シングルバイナリ

これにより、個人利用に最適な、保守しやすいコードベースを実現しています。
