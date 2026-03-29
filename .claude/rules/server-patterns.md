---
paths:
  - server/**
---

# Server Patterns

## アーキテクチャ（4層）

Model → Repository → Usecase → Presentation

- レイヤー間データは **Model型のみ**（DTOなし）
- **Usecase間の相互呼び出し禁止**
- Repository interface: `server/src/types/repository.ts`
- Context定義: `server/src/types/context.ts`（step別Context型: PreContext, ReadContext, ProcessContext, WriteContext, PostContext）
- 補助ディレクトリ: `lib/`（純粋関数ユーティリティ）、`setup/`（起動時初期化）、`mcp/`（MCPサーバー実装）、`db/`（DB初期化・マイグレーション）

## コーディング規約

- ID生成: 各Modelの `Model.create()` ファクトリ経由（内部で `generateId()` を使用）。直接 `generateId()` や `crypto.randomUUID()` を呼ばない
- 日時: Model内は `Date` 型、DB格納時は `dateToSQL()` / `dateFromSQL()` — `server/src/repositories/common.ts`
- SQLカラム: snake_case / TypeScript: camelCase
- Repository標準メソッド: `get(spec)`, `list(spec, cursor)`, `upsert(entity)`, `delete(spec)`
- DB操作は **upsert** (`INSERT ... ON CONFLICT DO UPDATE`)
- Schema変更: `server/schema.sql` 編集 → 起動時にpgschemaが差分を自動適用（migration script不要）
- DB: PostgreSQL（embedded-postgres）。`PgDatabase`ラッパー経由でクエリ実行。Repository層のメソッドは全て`async`

## Usecase

`usecase({ pre, read, process, write, post, result })` — 全ステップ省略可能。

各ステップには制限されたContext型が渡される:
- `pre`: `PreContext` (`{ now, logger }`)
- `read`: `ReadContext` (`{ now, logger, repos }`)
- `process`: `ProcessContext` (`{ now, logger }`) — **reposアクセス不可、純粋計算のみ**
- `write`: `WriteContext` (`{ now, logger, repos }`)
- `post`: `PostContext` (`{ now, logger, repos }`)
- `result`: Context不要 — 最終結果の変換（純粋関数）

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

## docs参照

- 詳細な実装例が必要な場合: `docs/05-backend.md` を参照
- ワークスペース/エージェント実行フロー: `docs/07-core-features.md` を参照
- チャットUI/承認システム: `docs/14-chat-interface.md` を参照
