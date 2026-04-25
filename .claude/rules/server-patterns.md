---
paths:
  - server/**
---

# Server Patterns

## アーキテクチャ（4層）

Model → Repository → Usecase → Presentation

- レイヤー間データは **Model型のみ**（DTOなし）
- **Usecase間の相互呼び出し禁止**
- Repository定義: `server/src/repositories/index.ts`（Repos型 + 全repository re-export）
- Context定義: `server/src/usecases/context.ts`
- インフラ層: `infra/`（意味単位のモジュール: db/, logger/, trpc/, port-file/）

## コーディング規約

- ID生成: 各Modelの `Model.create()` ファクトリ経由（内部で `generateId()` を使用）。直接 `generateId()` や `crypto.randomUUID()` を呼ばない
- 日時: Model内は `Date` 型、DB格納時は `dateToSQL()` / `dateFromSQL()` — `server/src/repositories/common.ts`
- SQLカラム: snake_case / TypeScript: camelCase
- Repository標準メソッド: `get(ctx, spec)`, `list(ctx, spec, cursor)`, `upsert(ctx, entity)`, `delete(ctx, spec)` — 第一引数はctx
- Repository interfaceは第一引数にDbReadCtx/DbWriteCtx/ServiceCtxマーカーを持つ。型関数DbRead<T>/DbWrite<T>/Service<T>/Full<T>で自動導出
- Database interface: `server/src/repositories/common/database.ts`（PgDatabaseが実装）
- DB操作は **upsert** (`INSERT ... ON CONFLICT DO UPDATE`)
- Schema変更: `server/schema.sql` 編集 → 起動時にpgschemaが差分を自動適用（migration script不要）
- DB: PostgreSQL（embedded-postgres）。`PgDatabase`ラッパー経由でクエリ実行。Repository層のメソッドは全て`async`

## Usecase

`usecase({ pre, read, process, write, post, result })` — 全ステップ省略可能。

各ステップには制限されたContext型が渡される:
- `pre`: `PreContext` (`{ now, logger }`)
- `read`: `ReadContext` (`{ now, logger, repos: DbReadRepos }`) — **DB readのみ、External不可**
- `process`: `ProcessContext` (`{ now, logger }`) — **reposアクセス不可、純粋計算のみ**
- `write`: `WriteContext` (`{ now, logger, repos: DbWriteRepos }`) — **DB read+write、External不可**
- `post`: `PostContext` (`{ now, logger, repos: FullRepos }`) — **全アクセス（トランザクション外）**
- `result`: Context不要 — 最終結果の変換（純粋関数）

read→process→writeはトランザクション内。writeあり→BEGIN、readのみ→BEGIN READ ONLY、どちらもなし→トランザクションなし。
External repo呼び出し（git, worktree, executor等）はpostステップでのみ実行（トランザクション停滞防止）。

```typescript
export const createProject = (input: CreateProjectInput) =>
  usecase({
    pre: async () => { /* バリデーション、fail()で早期リターン */ },
    read: (ctx) => { /* DB読み取り */ },
    process: (_ctx, data) => { /* 純粋なビジネスロジック（repos不可） */ },
    write: (ctx, data) => { /* DB書き込み */ },
    result: (data) => { /* 最終結果の変換（Context不要） */ },
  });
```

呼び出し: `createProject(input).run(ctx)` → `Result<T, Fail>`

**Presentation層で `handleResult()` により `Result<T, Fail>` → `T` に変換**。失敗時は `TRPCError` をthrow。
定義: `server/src/presentation/handle-result.ts`

## Fail型

`fail(code, message, details?)` / `isFail()` — return-basedエラーハンドリング。
定義: `server/src/models/common.ts`

## Model名前空間パターン

TypeScript declaration merging（interface + namespace）で型・Spec・ファクトリを統合:

```typescript
// Task.Status, Task.ById(), Task.create(), Task.Spec 等
export interface Task { id: string; status: Task.Status; ... }
export namespace Task {
  export type Status = 'todo' | 'inprogress' | ...;
  export type Spec = Comp<SpecsOf<typeof _specs>>;
  export type SortKey = 'createdAt' | 'updatedAt' | 'id';
  export const ById = _specs.ById;
  export function create(...): Task { ... }
}
```

## Specification Pattern

`defineSpecs()` でファクトリ生成 → `Task.ById(id)`, `Task.ByProject(projectId)` 等。
`Comp<T>` 型で `.and()` `.or()` `.not()` 合成。
Repository内で `compToSQL()` によりSQL WHERE句に変換。

## SQL Builder

Tagged template literal: `sql`, `sql.join()`, `sql.raw()`, `sql.list()`, `sql.empty()`
定義: `server/src/repositories/sql.ts` — Repository内のみで使用。

## N+1 回避 / 複数取得戦略

Specification Pattern + Raw SQL は柔軟だが、Usecase 内で多段 lookup を書くと N+1 になりやすい。
新しい read ステップを書くときは「ループ内で `repos.<x>.get` / `list` を呼んでいないか」を必ず確認する。

### N+1 の兆候

- `for (const item of items) { await ctx.repos.<x>.get(...) }` のような per-item の repo 呼び出し
- `Promise.all(items.map(item => ctx.repos.<x>.get(...)))` (見た目は並列だが N round-trip)
- 親エンティティのページを取得した後、子エンティティを per-parent で `list` する多段ループ
  （例: workspaces → 各 workspace の sessions → 各 session の processes）

### 解消パターン（優先順）

**A. 集合 Spec を足す（推奨デフォルト）**

複数 ID を一括 fetch するための spec を Model namespace に追加する。SQL 側は `IN (...)` に展開。

```ts
// Model
const _specs = defineSpecs({
  ByExecutionProcessId: (id: string) => ({ executionProcessId: id }),
  ByExecutionProcessIds: (ids: string[]) => ({ executionProcessIds: ids }),
});

// Repository (postgres/common.ts)
case "ByExecutionProcessIds":
  if (spec.executionProcessIds.length === 0) return sql`1 = 0`;
  return sql`execution_process_id IN (${sql.list(spec.executionProcessIds)})`;

// Usecase: 1 クエリにまとめてから Map で結合
const ids = parents.map(p => p.id);
const page = await ctx.repos.child.list(
  Child.ByParentIds(ids),
  { limit: ids.length },
);
const byParentId = new Map(page.items.map(c => [c.parentId, c]));
const result = parents.map(p => ({ ...p, child: byParentId.get(p.id) ?? null }));
```

事例: `server/src/usecases/execution/get-conversation-history.ts` — 旧実装は process 数だけ
`codingAgentTurn.get` を呼んでいたが、`CodingAgentTurn.ByExecutionProcessIds([...])` で 1 クエリに集約。

**B. 既存の単一値 spec を再利用する**

親→子が 1 つの単純な集合関係なら、わざわざ Plural spec を作らず既存 spec で list するだけで足りることがある。
例: `Session.ByWorkspaceId(workspaceId)` を 1 度だけ呼んで、全 session を取る。
親が複数あるときは A を使う。

**C. JOIN を SQL Builder で明示する**

集合 Spec で表現できない複合条件（resume info の「最新の completed turn」など、子テーブルの集約条件が必要な場合）は、Repository に専用メソッドを足して `JOIN` を直接書く。
事例: `server/src/repositories/coding-agent-turn/postgres/findLatestResumeInfoByWorkspaceId.ts` —
`coding_agent_turns` × `coding_agent_processes` × `sessions` を 1 クエリで JOIN。

### やってはいけないこと

- ORM 風の `include` / `with` API を作って Repository の責務を膨らませる — Raw SQL 戦略を崩す
- 集合 spec の代わりに `OR` で id を `.or()` 連鎖する — `compToSQL` は AND/OR を再帰展開するので動くが、
  巨大な OR ツリーは可読性も実行計画も悪い。`IN (...)` を使う
- 空配列を投げて `IN ()` を生成する — PostgreSQL で構文エラー。Repository 側で `length === 0` を弾いて `1 = 0` を返す（上の例の通り）

### PR 作法

N+1 を解消する PR は description に **解消前後のクエリ数** を書く（例: `processes 100 件で 101 → 2 クエリ`）。
測定が難しい場合は `PgDatabase` にクエリログを一時的に仕込んで数える（コミットしない）。

## specre 参照

- レイヤー構造と設計意図: `docs/specres/architecture/layered_architecture_separates_model_repository_usecase_presentation.md`
- Usecase の 6 ステップ詳細: `docs/specres/architecture/usecase_is_executed_in_6_steps.md`
- Specification Pattern: `docs/specres/architecture/specification_pattern_composes_db_filters.md`
- Raw SQL 戦略: `docs/specres/architecture/raw_sql_is_used_instead_of_orm.md`
- PostgreSQL (embedded-postgres): `docs/specres/architecture/postgresql_is_embedded_for_storage.md`
- ワークスペース / エージェント実行: `docs/specres/workspace/` + `docs/specres/execution/` カード群
- チャット UI / 承認システム: `docs/specres/approval/` + `docs/specres/permission/` + `docs/specres/ui-kanban/`
