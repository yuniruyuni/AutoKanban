# データベースとRepository Layer

## 概要

- **データベース**: PostgreSQL (embedded-postgres)
- **ORM**: なし（Raw SQL via `pg` node-postgres）
- **クエリ構築**: 合成可能なSQL Builder
- **パターン**: Specification Pattern + Repository Pattern
- **ID形式**: CUID2
- **スキーマ管理**: pgschema（宣言的差分適用）

## 設計方針

ORMを使用せず、PostgreSQL (embedded-postgres) を `pg` (node-postgres) 経由で直接使用してRaw SQLを記述する方針を採用。

**理由:**
- PostgreSQLの豊富な型システムと機能を活用
- 複雑なクエリの柔軟な構築
- Specification Patternによる合成可能な条件
- 学習コスト削減（SQLの知識がそのまま活用可能）

---

## SQL

SQLクエリとパラメータをカプセル化し、安全な合成操作を提供するイミュータブルなオブジェクト。

### 設計思想

- **イミュータブル**: すべての操作は新しいインスタンスを返す
- **合成可能**: concat, join などで自然に連結できる
- **安全**: パラメータは常にプレースホルダ経由でバインドされる
- **人間工学的**: Tagged Template Literalで直感的に記述できる

### 基本構造

```typescript
// repositories/sql.ts

/** SQLオブジェクトを識別するためのブランドシンボル */
const SQL_BRAND = Symbol.for('auto-kanban.SQL');

/**
 * SQLクエリ文字列とバインドパラメータをカプセル化するイミュータブルオブジェクト
 */
export class SQL {
  /** ブランド識別子（instanceof の代わりに使用） */
  readonly [SQL_BRAND] = true;

  /** SQLクエリ文字列（プレースホルダ付き） */
  readonly query: string;
  /** バインドパラメータ配列 */
  readonly params: readonly unknown[];

  constructor(query: string, params: readonly unknown[] = []) {
    this.query = query;
    this.params = Object.freeze([...params]);
  }

  /** SQLが空かどうか */
  isEmpty(): boolean {
    return this.query.trim() === '';
  }
}

/**
 * Tagged Template LiteralでSQLを作成
 *
 * @example
 * const query = sql`SELECT * FROM users WHERE name = ${name}`;
 * // query.query: "SELECT * FROM users WHERE name = ?"
 * // query.params: ["test"]
 *
 * @example
 * // 他のSQLを埋め込み可能
 * const where = sql`status = ${"active"}`;
 * const query = sql`SELECT * FROM tasks WHERE ${where}`;
 */
function sqlTemplate(strings: TemplateStringsArray, ...values: unknown[]): SQL {
  let query = '';
  const params: unknown[] = [];

  for (let i = 0; i < strings.length; i++) {
    query += strings[i];
    if (i < values.length) {
      const value = values[i];
      if (sql.isSQL(value)) {
        query += value.query;
        params.push(...value.params);
      } else {
        query += '?';
        params.push(value);
      }
    }
  }

  return new SQL(query, params);
}

/** 値がSQLオブジェクトかどうかを判定 */
function isSQL(value: unknown): value is SQL {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<symbol, unknown>)[SQL_BRAND] === true
  );
}

/** 複数のSQLを連結（区切り文字なし） */
function concat(...fragments: SQL[]): SQL {
  if (fragments.length === 0) return new SQL('');
  if (fragments.length === 1) return fragments[0];
  return new SQL(
    fragments.map(s => s.query).join(''),
    fragments.flatMap(s => [...s.params])
  );
}

/** 区切り文字で複数のSQLを結合 */
function join(separator: string, ...fragments: SQL[]): SQL {
  if (fragments.length === 0) return new SQL('');
  if (fragments.length === 1) return fragments[0];

  const result: string[] = [];
  const params: unknown[] = [];

  for (let i = 0; i < fragments.length; i++) {
    if (i > 0) result.push(separator);
    result.push(fragments[i].query);
    params.push(...fragments[i].params);
  }

  return new SQL(result.join(''), params);
}

/** 複数のSQLをANDで結合 */
function and(...conditions: SQL[]): SQL {
  const nonEmpty = conditions.filter(c => !c.isEmpty());
  if (nonEmpty.length === 0) return new SQL('1 = 1');
  if (nonEmpty.length === 1) return nonEmpty[0];
  return new SQL(
    nonEmpty.map(c => `(${c.query})`).join(' AND '),
    nonEmpty.flatMap(c => [...c.params])
  );
}

/** 複数のSQLをORで結合 */
function or(...conditions: SQL[]): SQL {
  const nonEmpty = conditions.filter(c => !c.isEmpty());
  if (nonEmpty.length === 0) return new SQL('1 = 0');
  if (nonEmpty.length === 1) return nonEmpty[0];
  return new SQL(
    nonEmpty.map(c => `(${c.query})`).join(' OR '),
    nonEmpty.flatMap(c => [...c.params])
  );
}

/** SQLをNOTで否定 */
function not(condition: SQL): SQL {
  if (condition.isEmpty()) return condition;
  return new SQL(`NOT (${condition.query})`, condition.params);
}

/** 複数のパラメータからプレースホルダリストを生成（IN句用） */
function params(...values: unknown[]): SQL {
  if (values.length === 0) return new SQL('');
  const placeholders = values.map(() => '?').join(', ');
  return new SQL(placeholders, values);
}

/** 括弧で囲む */
function wrap(condition: SQL): SQL {
  if (condition.isEmpty()) return condition;
  return new SQL(`(${condition.query})`, condition.params);
}

// sql関数にメソッドを追加
export const sql = Object.assign(sqlTemplate, {
  isSQL,
  concat,
  join,
  and,
  or,
  not,
  params,
  wrap,
});
```

### 使用例

```typescript
import { sql, SQL } from './sql';

// --- 基本的な使い方 ---

// Tagged Template Literalで直感的に記述
const projectId = 'proj-123';
const status = 'active';
const query = sql`
  SELECT * FROM tasks
  WHERE project_id = ${projectId}
    AND status = ${status}
`;
// query.query: "SELECT * FROM tasks WHERE project_id = ? AND status = ?"
// query.params: ["proj-123", "active"]

// --- SQLの合成 ---

// 動的なWHERE句の構築
function buildTaskQuery(filters: {
  projectId?: string;
  statuses?: string[];
  keyword?: string;
}): SQL {
  const conditions: SQL[] = [];

  if (filters.projectId) {
    conditions.push(sql`project_id = ${filters.projectId}`);
  }
  if (filters.statuses?.length) {
    conditions.push(sql`status IN (${sql.params(...filters.statuses)})`);
  }
  if (filters.keyword) {
    conditions.push(sql`title LIKE ${`%${filters.keyword}%`}`);
  }

  const where = sql.and(...conditions);

  return sql`SELECT * FROM tasks WHERE ${where}`;
}

// 使用
const query1 = buildTaskQuery({ projectId: 'p1', statuses: ['todo', 'inprogress'] });
// query1.query: "SELECT * FROM tasks WHERE project_id = ? AND status IN (?, ?) ..."

// --- 複雑なクエリの構築 ---

// JOINやサブクエリも安全に構築
const subquery = sql`
  SELECT task_id, COUNT(*) as count
  FROM workspaces
  GROUP BY task_id
`;

const mainQuery = sql`
  SELECT t.*, COALESCE(w.count, 0) as workspace_count
  FROM tasks t
  LEFT JOIN (${subquery}) w ON w.task_id = t.id
  WHERE t.project_id = ${projectId}
`;

// --- INSERT文の構築 ---

function buildInsert(table: string, data: Record<string, unknown>): SQL {
  const columns = Object.keys(data).join(', ');
  const values = Object.values(data);

  return sql`INSERT INTO ${new SQL(table)} (${new SQL(columns)}) VALUES (${sql.params(...values)})`;
}

// --- UPDATE文の構築 ---

function buildUpdate(table: string, id: string, data: Record<string, unknown>): SQL {
  const sets = Object.entries(data).map(([col, val]) => sql`${new SQL(col)} = ${val}`);
  const setClause = sql.join(', ', ...sets);

  return sql`UPDATE ${new SQL(table)} SET ${setClause} WHERE id = ${id}`;
}
```

### 利点

| 項目 | 説明 |
|------|------|
| **SQLインジェクション防止** | 値は常にプレースホルダ経由でバインドされる |
| **イミュータブル** | 状態変更がなく、予測可能な動作 |
| **合成可能** | SQL同士を安全に結合できる（`sql``内でSQL埋め込み可能） |
| **堅牢な型判定** | `Symbol.for()`ブランディングでバンドル間でも正しく動作 |
| **直感的な記法** | Tagged Template Literalで自然にSQLを書ける |
| **デバッグ容易** | sql/paramsが分離されており、ログ出力しやすい |
| **再利用性** | 共通条件をSQLとして切り出せる |

---

## ER図

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  projects   │────<│ project_repos│>────│    repos     │
└──────┬──────┘     └──────────────┘     └──────┬───────┘
       │                                        │
       │                                        │
       ▼                                        ▼
┌─────────────┐                         ┌──────────────────┐
│    tasks    │                         │  workspace_repos │
└──────┬──────┘                         └────────┬─────────┘
       │                                         │
       │                                         │
       ▼                                         ▼
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│ workspaces  │────<│   sessions   │────<│execution_    │
└─────────────┘     └──────────────┘     │processes     │
                                         └──────┬───────┘
                                                │
                                                ▼
                                         ┌──────────────────┐
                                         │execution_process_│
                                         │logs              │
                                         └──────────────────┘
```

## テーブル定義（SQL）

### 初期化スクリプト

```sql
-- server/src/repositories/schema.sql

-- projects
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  dev_script TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- repos
CREATE TABLE IF NOT EXISTS repos (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- project_repos
CREATE TABLE IF NOT EXISTS project_repos (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  repo_id TEXT NOT NULL REFERENCES repos(id),
  setup_script TEXT,
  cleanup_script TEXT,
  dev_server_script TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, repo_id)
);

-- tasks
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo'
    CHECK(status IN ('todo', 'inprogress', 'inreview', 'done', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- workspaces
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  container_ref TEXT NOT NULL,
  setup_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- sessions
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  executor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_workspace_id ON sessions(workspace_id);

-- execution_processes
CREATE TABLE IF NOT EXISTS execution_processes (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  run_reason TEXT NOT NULL DEFAULT 'setupscript'
    CHECK(run_reason IN ('setupscript', 'codingagent', 'devserver', 'cleanupscript')),
  status TEXT NOT NULL DEFAULT 'running'
    CHECK(status IN ('running', 'completed', 'failed', 'killed')),
  exit_code INTEGER,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_execution_processes_session_id ON execution_processes(session_id);
CREATE INDEX IF NOT EXISTS idx_execution_processes_status ON execution_processes(status);

-- execution_process_logs
CREATE TABLE IF NOT EXISTS execution_process_logs (
  execution_process_id TEXT PRIMARY KEY REFERENCES execution_processes(id),
  logs TEXT NOT NULL DEFAULT ''
);

-- workspace_repos
CREATE TABLE IF NOT EXISTS workspace_repos (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  repo_id TEXT NOT NULL REFERENCES repos(id),
  target_branch TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, repo_id)
);

-- approvals (permission/plan approval requests, DB-persisted)
CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  execution_process_id TEXT NOT NULL REFERENCES execution_processes(id),
  tool_name TEXT NOT NULL,
  tool_call_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'approved', 'denied')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approvals_execution_process_id ON approvals(execution_process_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);

-- tools
CREATE TABLE IF NOT EXISTS tools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  icon_color TEXT NOT NULL DEFAULT '#6B7280',
  command TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Specification Pattern

クエリ条件を**ヘルパー関数**で構築。`type`フィールドで識別するdiscriminated unionパターンを使用。

### 設計方針

- **ヘルパー関数**: `Task.ById('abc')` のように関数で構築（`type`は自動付与）
- **discriminated union**: `type`フィールドで条件の種類を識別
- **namespaceで組織化**: `Task.Spec`のようにModelに紐づけて定義
- **Comp\<T\>で合成**: `and()`/`or()`/`not()`ヘルパーで合成

### ディレクトリ構造

```
models/
  common.ts              # Comp<T>型、defineSpecs、SpecsOf、and/or/not
  task.ts                # Task Model + Task.Spec（namespace）
  project.ts             # Project Model + Project.Spec
  workspace.ts           # Workspace Model + Workspace.Spec
  ...
```

### 共通型とヘルパー

```typescript
// models/common.ts

/**
 * Specification Composition - 基本Specに and/or/not を付与するジェネリック型
 */
export type Comp<T> =
  | T
  | { type: 'and'; children: Comp<T>[] }
  | { type: 'or'; children: Comp<T>[] }
  | { type: 'not'; child: Comp<T> };

/** Comp用ヘルパー関数 */
export const and = <T>(...children: Comp<T>[]): Comp<T> => ({ type: 'and', children });
export const or = <T>(...children: Comp<T>[]): Comp<T> => ({ type: 'or', children });
export const not = <T>(child: Comp<T>): Comp<T> => ({ type: 'not', child });

/**
 * Spec定義ヘルパー: 各関数の戻り値に type: 関数名 を自動付与
 *
 * @example
 * const specs = defineSpecs({
 *   ById: (id: string) => ({ id }),
 *   ByName: (name: string) => ({ name }),
 * });
 * specs.ById('123') // → { type: 'ById', id: '123' }
 */
export function defineSpecs<T extends Record<string, (...args: never[]) => object>>(
  specs: T
): {
  [K in keyof T & string]: (...args: Parameters<T[K]>) => ReturnType<T[K]> & { type: K }
} {
  const result = {} as Record<string, unknown>;
  for (const key in specs) {
    result[key] = (...args: unknown[]) => ({
      type: key,
      ...(specs[key] as (...args: unknown[]) => object)(...args),
    });
  }
  return result as never;
}

/**
 * オブジェクトから Spec 型（type プロパティを持つ戻り値）のみを抽出
 *
 * @example
 * export const Task = {
 *   ...defineSpecs({ ById: (id: string) => ({ id }) }),
 *   validate: (task: Task) => boolean,  // これは除外される
 * };
 * type Spec = SpecsOf<typeof Task>;  // { type: 'ById'; id: string }
 */
export type SpecsOf<T> = {
  [K in keyof T]: T[K] extends (...args: never[]) => infer R
    ? R extends { type: string } ? R : never
    : never
}[keyof T];
```

### Model定義（Task）

```typescript
// models/task.ts
import { defineSpecs, type SpecsOf } from './common';

/** Task Model */
export type Task = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: Task.Status;
  createdAt: Date;
  updatedAt: Date;
};

/** Task Spec構築関数 */
export const Task = defineSpecs({
  ById: (id: string) => ({ id }),
  ByProject: (projectId: string) => ({ projectId }),
  ByStatus: (status: Task.Status) => ({ status }),
  ByStatuses: (...statuses: Task.Status[]) => ({ statuses }),
  ByTitleContains: (keyword: string) => ({ keyword }),
  ByCreatedAtRange: (from?: string, to?: string) => ({ from, to }),
});

/** Task関連の型定義 */
export namespace Task {
  export type Status = 'todo' | 'inprogress' | 'inreview' | 'done' | 'cancelled';
  export type Spec = SpecsOf<typeof Task>;
}

// ビジネスルール
const VALID_TRANSITIONS: Record<Task.Status, Task.Status[]> = {
  todo: ['inprogress', 'cancelled'],
  inprogress: ['todo', 'inreview', 'done', 'cancelled'],
  inreview: ['inprogress', 'done', 'cancelled'],
  done: ['todo'],
  cancelled: ['todo'],
};

export function canTransitionStatus(from: Task.Status, to: Task.Status): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}
```

### Model定義（Project）

```typescript
// models/project.ts
import { defineSpecs, type SpecsOf } from './common';

/** Project Model */
export type Project = {
  id: string;
  name: string;
  devScript: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Project Spec構築関数 */
export const Project = defineSpecs({
  ById: (id: string) => ({ id }),
  ByNameContains: (keyword: string) => ({ keyword }),
});

/** Project関連の型定義 */
export namespace Project {
  export type Spec = SpecsOf<typeof Project>;
}
```

### Spec → SQL変換（Repository層）

SpecificationはModel層で定義されますが、SQLへの変換はRepository層で行います。
`and`/`or`/`not`の処理は共通化し、基本Specの変換は各Repositoryが提供します。

### 共通変換関数

```typescript
// repositories/common.ts
import { sql, SQL } from './sql';
import type { Comp } from '../models/common';

/**
 * Comp<T> → SQL 変換の共通処理
 *
 * and/or/not の処理を共通化し、基本Specの変換はコールバックに委譲
 */
export function compToSQL<T extends { type: string }>(
  spec: Comp<T>,
  toSQL: (base: T) => SQL
): SQL {
  switch (spec.type) {
    case 'and': {
      const { children } = spec as { type: 'and'; children: Comp<T>[] };
      return sql.and(...children.map(c => compToSQL(c, toSQL)));
    }

    case 'or': {
      const { children } = spec as { type: 'or'; children: Comp<T>[] };
      return sql.or(...children.map(c => compToSQL(c, toSQL)));
    }

    case 'not': {
      const { child } = spec as { type: 'not'; child: Comp<T> };
      return sql.not(compToSQL(child, toSQL));
    }

    default:
      return toSQL(spec as T);
  }
}
```

### Repository実装

Repository層では`Comp<Task.Spec>`を受け取り、共通関数で変換します。

```typescript
// repositories/task/repository.ts - Repository interface定義
import type { DbReadCtx, DbWriteCtx } from '../common';
import type { Cursor, Page } from '../../models/common';
import type { Task } from '../../models/task';

// DbReadCtx/DbWriteCtxを第一引数に取るパターン
export interface TaskRepository {
  get(ctx: DbReadCtx, spec: Task.Spec): Promise<Task | null>;
  list(ctx: DbReadCtx, spec: Task.Spec, cursor: Cursor<Task.SortKey>): Promise<Page<Task>>;
  count(ctx: DbReadCtx, spec: Task.Spec): Promise<number>;
  upsert(ctx: DbWriteCtx, task: Task): Promise<void>;
  delete(ctx: DbWriteCtx, spec: Task.Spec): Promise<number>;
}

// repositories/task/postgres/index.ts - PostgreSQL実装
import type { DbReadCtx, DbWriteCtx } from '../../common';
import { sql, SQL } from '../../common';
import { compToSQL } from '../../common';
import type { Task } from '../../../models/task';

function taskSpecToSQL(spec: Task.Spec): SQL {
  switch (spec.type) {
    case 'ById':
      return sql`id = ${spec.id}`;
    case 'ByProject':
      return sql`project_id = ${spec.projectId}`;
    case 'ByStatuses':
      return sql`status IN (${sql.params(...spec.statuses)})`;
    // ...
  }
}

export class TaskRepositoryPostgres implements TaskRepository {
  // ctxを第一引数で受け取り、ctx.db経由でクエリ実行
  async get(ctx: DbReadCtx, spec: Task.Spec): Promise<Task | null> {
    const where = compToSQL(spec, taskSpecToSQL);
    return ctx.db.queryGet<Task>(sql`SELECT * FROM tasks WHERE ${where}`);
  }

  async upsert(ctx: DbWriteCtx, task: Task): Promise<void> {
    await ctx.db.queryRun(sql`
      INSERT INTO tasks (id, project_id, title, ...)
      VALUES (${task.id}, ${task.projectId}, ${task.title}, ...)
      ON CONFLICT(id) DO UPDATE SET ...
    `);
  }
}
```

```typescript
// repositories/project/repository.ts
import type { DbReadCtx, DbWriteCtx } from '../common';
import type { Project } from '../../models/project';

export interface ProjectRepository {
  get(ctx: DbReadCtx, spec: Project.Spec): Promise<Project | null>;
  list(ctx: DbReadCtx, spec: Project.Spec, cursor: Cursor<Project.SortKey>): Promise<Page<Project>>;
  upsert(ctx: DbWriteCtx, project: Project): Promise<void>;
}
```

### 責務の分離

| 層 | ファイル | 責務 |
|---|---|---|
| **Model層** | `models/common.ts` | `Comp<T>`ジェネリック型 |
| **Model層** | `models/xxx.ts` | `Xxx` + `Xxx.Spec`（namespaceで組織化） |
| **Repository層** | `repositories/common.ts` | `compToSQL`共通関数（and/or/not処理） |
| **Repository層** | `repositories/xxx-repository.ts` | `xxxSpecToSQL`（基本Spec→SQL変換） |

### 使い分け

| シーン | 型 | 例 |
|---|---|---|
| Model層でSpecを定義 | `Xxx.Spec` | `Task.Spec`, `Project.Spec` |
| Repository/Usecaseで合成条件を使う | `Comp<Xxx.Spec>` | `Comp<Task.Spec>` |
| 単一条件のみ（合成不要） | `Xxx.Spec`でもOK | `Task.ById('...')` |

この分離により：
- **namespaceで組織化**: `Task.Spec`, `Task.Status`が自然にグループ化
- **合成は使用側で明示**: `Comp<Task.Spec>`で「合成可能」と明示
- **and/or/not処理**は1箇所で共通化（DRY原則）
- **基本Spec変換**は各Repositoryが責任を持つ

### 使用例

```typescript
import { and, or, not, type Comp } from '../models/common';
import { Task } from '../models/task';

// プロジェクト内の未完了タスクを検索
const spec: Comp<Task.Spec> = and(
  Task.ByProject('project-123'),
  Task.ByStatuses('todo', 'inprogress'),
);

// キーワード検索付き
const searchSpec: Comp<Task.Spec> = and(
  Task.ByProject('project-123'),
  Task.ByStatuses('todo', 'inprogress'),
  Task.ByTitleContains('bug'),
);

// OR条件
const orSpec: Comp<Task.Spec> = or(
  Task.ByStatus('done'),
  Task.ByStatus('cancelled'),
);

// NOT条件
const notSpec: Comp<Task.Spec> = not(Task.ByStatus('cancelled'));

// 単純な条件（Task.SpecはComp<Task.Spec>に代入可能）
const simpleSpec: Task.Spec = Task.ById('task-123');
```

## Pagination

### カーソルベースページネーション型定義

カーソルベースのページネーションを採用。オフセットベースと比較して以下の利点がある：
- データ追加・削除時にページずれが発生しない
- 大量データでもパフォーマンスが安定（OFFSET の O(n) 問題を回避）
- 無限スクロールUIとの相性が良い

### 共通型定義（Model層）

ソート可能なフィールドはModel層で定義し、パフォーマンス問題を防ぐ。

```typescript
// models/common.ts

/** ソート方向 */
export type SortDirection = 'asc' | 'desc';

/**
 * ソート条件
 * @template K ソート可能なフィールド名（Model層で制約）
 */
export interface Sort<K extends string> {
  field: K;
  direction: SortDirection;
}

/**
 * カーソル位置（ソートフィールドの値を保持）
 * 複数フィールドソート時は各フィールドの値を含む
 */
export type CursorPosition = Record<string, unknown>;

/**
 * カーソル（ページネーションリクエスト）
 * @template K ソート可能なフィールド名
 */
export interface Cursor<K extends string> {
  /** カーソル位置（前回の最後のアイテムの位置。最初のリクエストではundefined） */
  after?: CursorPosition;
  /** 取得件数 */
  limit: number;
  /** ソート条件（必須。順序を定義） */
  sort: Sort<K>[];
}

/**
 * ページ（カーソルベースのページネーション結果）
 */
export interface Page<T> {
  /** データ配列 */
  items: T[];
  /** 次のページのカーソル位置（次がなければundefined） */
  nextCursor?: CursorPosition;
  /** 次のページがあるか */
  hasMore: boolean;
}
```

### Model層でのSortKey定義

各Modelはソート可能なフィールドを`SortKey`として定義。インデックス済みフィールドに限定することでパフォーマンスを保証。

#### SortKeyの規約

**ソート順の最後には必ず主キー（id）を含めること。**

Keyset Paginationでは、ソート順が完全に決定的である必要がある。同じ値を持つレコードが複数存在する場合（例：同一時刻のcreatedAt）、ページ境界でレコードが重複・欠落する可能性がある。主キーを最後のソートフィールドとして追加することで、常に一意な順序が保証される。

```typescript
// ✓ 正しい: 最後にidを含む
const defaultSort: Sort<SortKey>[] = [
  { field: 'createdAt', direction: 'desc' },
  { field: 'id', direction: 'desc' },  // 主キーで決定性を保証
];

// ✗ 誤り: 主キーなし（同一createdAtで順序不定）
const defaultSort: Sort<SortKey>[] = [
  { field: 'createdAt', direction: 'desc' },
];
```

この規約はすべてのModel.defaultSortおよびクライアントからのsortパラメータに適用される。Presentation層でソートを受け付ける際は、主キーが含まれていない場合に自動で追加するか、バリデーションエラーとすることを推奨する。

```typescript
// models/task.ts
import { defineSpecs, type SpecsOf, type Sort, type CursorPosition } from './common';

export type Task = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: Task.Status;
  createdAt: Date;
  updatedAt: Date;
};

export const Task = defineSpecs({
  ById: (id: string) => ({ id }),
  ByProject: (projectId: string) => ({ projectId }),
  ByStatus: (status: Task.Status) => ({ status }),
  ByStatuses: (...statuses: Task.Status[]) => ({ statuses }),
});

export namespace Task {
  export type Status = 'todo' | 'inprogress' | 'inreview' | 'done' | 'cancelled';
  export type Spec = SpecsOf<typeof Task>;

  /**
   * ソート可能なフィールド（インデックス済みフィールドに限定）
   * パフォーマンス考慮で任意フィールドのソートは許可しない
   */
  export type SortKey = 'id' | 'createdAt' | 'updatedAt';

  /** デフォルトソート（新しい順） */
  export const defaultSort: Sort<SortKey>[] = [
    { field: 'createdAt', direction: 'desc' },
    { field: 'id', direction: 'desc' },  // 同一時刻の場合の決定性を保証
  ];

  /**
   * Taskからカーソル位置を取得
   * ソートフィールドの値を抽出してCursorPositionを構築
   */
  export function cursor(task: Task, sortKeys: SortKey[]): CursorPosition {
    const position: CursorPosition = {};
    for (const key of sortKeys) {
      const value = task[key];
      // DateはISO文字列に変換（SQL比較のため）
      position[key] = value instanceof Date ? value.toISOString() : value;
    }
    return position;
  }
}

// models/project.ts
export namespace Project {
  export type Spec = SpecsOf<typeof Project>;

  /** ソート可能なフィールド */
  export type SortKey = 'id' | 'name' | 'createdAt' | 'updatedAt';

  /** デフォルトソート */
  export const defaultSort: Sort<SortKey>[] = [
    { field: 'createdAt', direction: 'desc' },
    { field: 'id', direction: 'desc' },
  ];

  export function cursor(project: Project, sortKeys: SortKey[]): CursorPosition {
    const position: CursorPosition = {};
    for (const key of sortKeys) {
      const value = project[key];
      position[key] = value instanceof Date ? value.toISOString() : value;
    }
    return position;
  }
}
```

### Repository層でのPager実装

```typescript
// repositories/pagination.ts
import { sql, SQL } from './sql';
import type { Cursor, CursorPosition, Page, Sort, SortDirection } from '../models/common';

/**
 * SortKeyからSQLカラム名へのマッピング
 */
export type ColumnMapping<K extends string> = Record<K, string>;

/**
 * Pager: CursorからSQL条件を生成し、結果をPageに変換するオブジェクト
 */
export interface Pager<K extends string> {
  /** WHERE句に追加するカーソル条件（既存条件にANDで結合） */
  where(): SQL;
  /** ORDER BY句 */
  orderBy(): SQL;
  /** LIMIT句（limit + 1 で取得してhasMoreを判定） */
  limit(): SQL;
  /** 取得結果からPageを構築 */
  createPage<T>(items: T[], getCursor: (item: T) => CursorPosition): Page<T>;
}

/**
 * Pagerを生成
 *
 * @param cursor クライアントからのカーソルリクエスト
 * @param columns SortKeyからSQLカラム名へのマッピング
 * @returns Pagerオブジェクト
 *
 * @example
 * const pager = createPager(cursor, TASK_COLUMNS);
 * const fragment = sql`
 *   SELECT * FROM tasks
 *   WHERE ${where} AND ${pager.where()}
 *   ${pager.orderBy()}
 *   ${pager.limit()}
 * `;
 * const items = query(fragment);
 * return pager.createPage(items, task => Task.cursor(task, sortKeys));
 */
export function createPager<K extends string>(
  cursor: Cursor<K>,
  columns: ColumnMapping<K>
): Pager<K> {
  const fetchLimit = cursor.limit + 1;

  return {
    where: () => buildCursorWhere(cursor, columns),
    orderBy: () => buildOrderBy(cursor.sort, columns),
    limit: () => sql`LIMIT ${fetchLimit}`,
    createPage: <T>(items: T[], getCursor: (item: T) => CursorPosition): Page<T> => {
      const hasMore = items.length > cursor.limit;
      const resultItems = hasMore ? items.slice(0, cursor.limit) : items;
      const lastItem = resultItems[resultItems.length - 1];

      return {
        items: resultItems,
        nextCursor: hasMore && lastItem ? getCursor(lastItem) : undefined,
        hasMore,
      };
    },
  };
}

/**
 * ORDER BY句を生成
 */
function buildOrderBy<K extends string>(
  sort: Sort<K>[],
  columns: ColumnMapping<K>
): SQL {
  if (sort.length === 0) {
    return sql``;
  }

  const parts = sort.map(s => {
    const col = new SQL(columns[s.field]);
    const dir = s.direction === 'asc' ? sql`ASC` : sql`DESC`;
    return sql`${col} ${dir}`;
  });

  return sql`ORDER BY ${sql.join(', ', ...parts)}`;
}

/**
 * カーソル条件のWHERE句を生成（Keyset Pagination）
 *
 * 複数フィールドソートの場合、以下のようなWHERE句を生成:
 * sort: [{ field: 'createdAt', direction: 'desc' }, { field: 'id', direction: 'desc' }]
 * after: { createdAt: '2024-01-01', id: 'abc' }
 *
 * → WHERE (created_at < '2024-01-01')
 *      OR (created_at = '2024-01-01' AND id < 'abc')
 */
function buildCursorWhere<K extends string>(
  cursor: Cursor<K>,
  columns: ColumnMapping<K>
): SQL {
  if (!cursor.after || cursor.sort.length === 0) {
    return sql`1=1`;
  }

  const conditions: SQL[] = [];

  // 各ソートフィールドについて条件を構築
  for (let i = 0; i < cursor.sort.length; i++) {
    const equalParts: SQL[] = [];
    const currentSort = cursor.sort[i];
    const col = new SQL(columns[currentSort.field]);
    const value = cursor.after[currentSort.field];

    // 前のフィールドはすべて等しい
    for (let j = 0; j < i; j++) {
      const prevSort = cursor.sort[j];
      const prevCol = new SQL(columns[prevSort.field]);
      const prevValue = cursor.after[prevSort.field];
      equalParts.push(sql`${prevCol} = ${prevValue}`);
    }

    // 現在のフィールドは比較演算子で比較
    const comparator = currentSort.direction === 'desc' ? '<' : '>';
    const comparison = sql`${col} ${new SQL(comparator)} ${value}`;

    if (equalParts.length > 0) {
      conditions.push(sql.wrap(sql.and(...equalParts, comparison)));
    } else {
      conditions.push(comparison);
    }
  }

  return sql.wrap(sql.or(...conditions));
}

/**
 * デフォルトのCursorを生成
 */
export function defaultCursor<K extends string>(
  defaultSort: Sort<K>[],
  override?: Partial<Cursor<K>>
): Cursor<K> {
  return {
    limit: 20,
    sort: defaultSort,
    ...override,
  };
}
```

### 責務の分離

| オブジェクト | 層 | 責務 |
|-------------|-----|------|
| **SortKey** | Model | ソート可能なフィールドを型で制約 |
| **Model.cursor()** | Model | モデルから自身のカーソル位置を取得 |
| **Model.defaultSort** | Model | デフォルトのソート順を定義 |
| **Cursor\<K\>** | 共通 | クライアントからのリクエスト（after, limit, sort） |
| **ColumnMapping** | Repository | SortKeyからSQLカラム名への変換 |
| **Pager** | Repository | CursorからSQL条件を生成、結果をPageに変換 |
| **Page\<T\>** | 共通 | クライアントへのレスポンス（items, nextCursor, hasMore） |

### Keyset Paginationの利点

従来のOFFSET方式と比較した利点:
- **パフォーマンス**: インデックスを活用でき、大量データでもO(1)
- **整合性**: データ追加・削除でページずれが発生しない
- **柔軟なソート**: 複数フィールドでのソートに対応

## Repository設計

### 設計方針

- **1 Model = 1 Repository**: 各Modelに対応するRepositoryが1つ存在
- **SQL直接使用**: RepositoryはSQLを直接記述（JOINなど複雑なクエリに対応）
- **Model固有のSpecification**: 各Modelに対応するSpecificationのunion typeを定義
- **標準メソッド**: DBアクセスRepositoryは以下の標準メソッドを持つ
  - `list(spec, cursor): Page<Model>` - カーソルベース一覧取得
  - `get(spec): Model | null` - 条件に一致する1件取得
  - `upsert(model): void` - 挿入または更新
  - `delete(spec): void` - 条件に一致するレコード削除
  - `count(spec): number` - 条件に一致する件数取得

### なぜTableAccessヘルパーを使わないか

- Modelは必ずしもテーブルと1:1対応しない
- JOINや複雑なクエリが必要なケースが多い
- SQLを直接書く方が柔軟で明示的

### TaskRepository実装

```typescript
// repositories/task-repository.ts
import { PgDatabase } from '../repositories/common';
import { sql, SQL } from './sql';
import { compToSQL } from './common';
import { createPager, type Cursor, type Page, type ColumnMapping } from './pagination';
import type { Comp } from '../models/common';
import { Task } from '../models/task';

/**
 * SortKeyからSQLカラム名へのマッピング
 */
const TASK_COLUMNS: ColumnMapping<Task.SortKey> = {
  id: 'id',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

/**
 * Task Modelに対応するRepository
 */
export class TaskRepository {
  constructor(private db: PgDatabase) {}

  // ========================================
  // 内部ヘルパー
  // ========================================

  private query<R>(fragment: SQL): R[] {
    return this.db.queryAll(fragment.sql, fragment.params) as R[];
  }

  private queryOne<R>(fragment: SQL): R | null {
    return this.db.queryGet(fragment.sql, fragment.params) as R | null;
  }

  private execute(fragment: SQL): void {
    this.db.queryRun(fragment.sql, fragment.params);
  }

  private mapRow(row: Record<string, unknown>): Task {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      title: row.title as string,
      description: row.description as string | null,
      status: row.status as Task.Status,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  // ========================================
  // 標準メソッド
  // ========================================

  /** カーソルベース一覧取得 */
  list(spec: Comp<Task.Spec>, cursor: Cursor<Task.SortKey>): Page<Task> {
    const where = compToSQL(spec, taskSpecToSQL);
    const pager = createPager(cursor, TASK_COLUMNS);
    const sortKeys = cursor.sort.map(s => s.field);

    const fragment = sql`
      SELECT * FROM tasks
      WHERE ${where} AND ${pager.where()}
      ${pager.orderBy()}
      ${pager.limit()}
    `;
    const rows = this.query<Record<string, unknown>>(fragment);
    const items = rows.map(r => this.mapRow(r));

    return pager.createPage(items, task => Task.cursor(task, sortKeys));
  }

  /** 条件に一致する1件取得 */
  get(spec: Comp<Task.Spec>): Task | null {
    const where = compToSQL(spec, taskSpecToSQL);
    const fragment = sql`
      SELECT * FROM tasks WHERE ${where} LIMIT 1
    `;
    const row = this.queryOne<Record<string, unknown>>(fragment);
    return row ? this.mapRow(row) : null;
  }

  /** 挿入または更新 */
  upsert(task: Task): void {
    const fragment = sql`
      INSERT INTO tasks (id, project_id, title, description, status, created_at, updated_at)
      VALUES (
        ${task.id},
        ${task.projectId},
        ${task.title},
        ${task.description},
        ${task.status},
        ${task.createdAt.toISOString()},
        ${task.updatedAt.toISOString()}
      )
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        title = excluded.title,
        description = excluded.description,
        status = excluded.status,
        updated_at = excluded.updated_at
    `;
    this.execute(fragment);
  }

  /** 条件に一致するレコードを削除 */
  delete(spec: Comp<Task.Spec>): void {
    const where = compToSQL(spec, taskSpecToSQL);
    const fragment = sql`DELETE FROM tasks WHERE ${where}`;
    this.execute(fragment);
  }

  /** 条件に一致する件数を取得 */
  count(spec: Comp<Task.Spec>): number {
    const where = compToSQL(spec, taskSpecToSQL);
    const fragment = sql`
      SELECT COUNT(*) as count FROM tasks WHERE ${where}
    `;
    return this.queryOne<{ count: number }>(fragment)?.count ?? 0;
  }

  // ========================================
  // ドメイン固有メソッド
  // ========================================

  /**
   * プロジェクト内のタスク取得（ワークスペース数込み）
   */
  listByProjectWithWorkspaces(projectId: string): (Task & { workspaceCount: number })[] {
    const fragment = sql`
      SELECT
        t.*,
        COUNT(w.id) as workspace_count
      FROM tasks t
      LEFT JOIN workspaces w ON w.task_id = t.id
      WHERE t.project_id = ${projectId}
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `;
    const rows = this.query<Record<string, unknown> & { workspace_count: number }>(fragment);

    return rows.map(row => ({
      ...this.mapRow(row),
      workspaceCount: row.workspace_count,
    }));
  }
}
```

### ProjectRepository実装

```typescript
// repositories/project-repository.ts
import { PgDatabase } from '../repositories/common';
import { sql, SQL } from './sql';
import { compToSQL } from './common';
import { createPager, type Cursor, type Page, type ColumnMapping } from './pagination';
import type { Comp } from '../models/common';
import { Project } from '../models/project';

/**
 * SortKeyからSQLカラム名へのマッピング
 */
const PROJECT_COLUMNS: ColumnMapping<Project.SortKey> = {
  id: 'id',
  name: 'name',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

/**
 * Project Modelに対応するRepository
 */
export class ProjectRepository {
  constructor(private db: PgDatabase) {}

  private query<R>(fragment: SQL): R[] {
    return this.db.queryAll(fragment.sql, fragment.params) as R[];
  }

  private queryOne<R>(fragment: SQL): R | null {
    return this.db.queryGet(fragment.sql, fragment.params) as R | null;
  }

  private execute(fragment: SQL): void {
    this.db.queryRun(fragment.sql, fragment.params);
  }

  private mapRow(row: Record<string, unknown>): Project {
    return {
      id: row.id as string,
      name: row.name as string,
      devScript: row.dev_script as string | null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  // ========================================
  // 標準メソッド
  // ========================================

  list(spec: Comp<Project.Spec>, cursor: Cursor<Project.SortKey>): Page<Project> {
    const where = compToSQL(spec, projectSpecToSQL);
    const pager = createPager(cursor, PROJECT_COLUMNS);
    const sortKeys = cursor.sort.map(s => s.field);

    const fragment = sql`
      SELECT * FROM projects
      WHERE ${where} AND ${pager.where()}
      ${pager.orderBy()}
      ${pager.limit()}
    `;
    const rows = this.query<Record<string, unknown>>(fragment);
    const items = rows.map(r => this.mapRow(r));

    return pager.createPage(items, project => Project.cursor(project, sortKeys));
  }

  get(spec: Comp<Project.Spec>): Project | null {
    const where = compToSQL(spec, projectSpecToSQL);
    const fragment = sql`
      SELECT * FROM projects WHERE ${where} LIMIT 1
    `;
    const row = this.queryOne<Record<string, unknown>>(fragment);
    return row ? this.mapRow(row) : null;
  }

  upsert(project: Project): void {
    const fragment = sql`
      INSERT INTO projects (id, name, dev_script, created_at, updated_at)
      VALUES (
        ${project.id},
        ${project.name},
        ${project.devScript},
        ${project.createdAt.toISOString()},
        ${project.updatedAt.toISOString()}
      )
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        dev_script = excluded.dev_script,
        updated_at = excluded.updated_at
    `;
    this.execute(fragment);
  }

  delete(spec: Comp<Project.Spec>): void {
    const where = compToSQL(spec, projectSpecToSQL);
    const fragment = sql`DELETE FROM projects WHERE ${where}`;
    this.execute(fragment);
  }

  count(spec: Comp<Project.Spec>): number {
    const where = compToSQL(spec, projectSpecToSQL);
    const fragment = sql`
      SELECT COUNT(*) as count FROM projects WHERE ${where}
    `;
    return this.queryOne<{ count: number }>(fragment)?.count ?? 0;
  }

  // ========================================
  // ドメイン固有メソッド
  // ========================================

  /**
   * プロジェクト詳細（タスク数・リポジトリ数込み）
   */
  getByIdWithDetails(id: string): (Project & { taskCount: number; repoCount: number }) | null {
    const fragment = sql`
      SELECT
        p.*,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
        (SELECT COUNT(*) FROM project_repos WHERE project_id = p.id) as repo_count
      FROM projects p
      WHERE p.id = ${id}
    `;
    const row = this.queryOne<Record<string, unknown> & {
      task_count: number;
      repo_count: number;
    }>(fragment);

    if (!row) return null;

    return {
      ...this.mapRow(row),
      taskCount: row.task_count,
      repoCount: row.repo_count,
    };
  }
}
```

### 外部システムRepository（DB以外の例）

DBアクセス以外のRepositoryは独自に実装。

```typescript
// repositories/git-repository.ts
import { $ } from 'bun';

/**
 * Git操作を抽象化するRepository
 */
export class GitRepository {
  async createWorktree(options: {
    repoPath: string;
    worktreePath: string;
    branch: string;
    baseBranch?: string;
  }): Promise<void> {
    const { repoPath, worktreePath, branch, baseBranch = 'main' } = options;
    await $`git -C ${repoPath} branch ${branch} ${baseBranch}`.quiet();
    await $`git -C ${repoPath} worktree add ${worktreePath} ${branch}`.quiet();
  }

  async removeWorktree(options: {
    repoPath: string;
    worktreePath: string;
    branch: string;
  }): Promise<void> {
    const { repoPath, worktreePath, branch } = options;
    await $`git -C ${repoPath} worktree remove ${worktreePath} --force`.quiet();
    await $`git -C ${repoPath} branch -D ${branch}`.quiet();
  }

  async diff(repoPath: string, from: string, to = 'HEAD'): Promise<string> {
    return await $`git -C ${repoPath} diff ${from}..${to}`.text();
  }
}
```

## トランザクション

```typescript
// repositories/transaction.ts
import { PgDatabase } from '../repositories/common';

/**
 * 非同期トランザクション
 * PostgreSQLのトランザクションはPgDatabase経由で実行
 */
export async function transactionAsync<T>(
  db: PgDatabase,
  fn: (db: PgDatabase) => Promise<T>
): Promise<T> {
  await db.queryRun('BEGIN');
  try {
    const result = await fn(db);
    await db.queryRun('COMMIT');
    return result;
  } catch (error) {
    await db.queryRun('ROLLBACK');
    throw error;
  }
}
```

## データベース初期化

```typescript
// repositories/database.ts
import { PgDatabase } from '../repositories/common';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function initializeDatabase(): Promise<PgDatabase> {
  const db = new PgDatabase();

  // pgschemaがschema.sqlの差分を自動適用
  await db.applySchema();

  return db;
}
```

## 使用例（Usecaseから）

```typescript
// usecases/list-tasks.ts
import type { PgDatabase } from '../repositories/common';
import { TaskRepository } from '../repositories/task-repository';
import { and, type Comp } from '../models/common';
import { Task } from '../models/task';
import type { Cursor, Page } from '../repositories/pagination';

/**
 * Usecaseはmodelの型でデータを受け渡し
 * 独自のDTO/データ構造を定義しない
 */
export class ListTasksUsecase {
  private taskRepo: TaskRepository;

  constructor(db: PgDatabase) {
    this.taskRepo = new TaskRepository(db);
  }

  execute(
    projectId: string,
    statuses: Task.Status[] | undefined,
    cursor: Cursor<Task.SortKey>
  ): Page<Task> {
    // Comp<Task.Spec>でand/or/not合成可能な条件を構築
    const spec: Comp<Task.Spec> = statuses && statuses.length > 0
      ? and(Task.ByProject(projectId), Task.ByStatuses(...statuses))
      : Task.ByProject(projectId);  // 単一条件もComp<Task.Spec>に代入可能

    return this.taskRepo.list(spec, cursor);
  }
}

// usecases/create-task.ts
import type { PgDatabase } from '../repositories/common';
import { createId } from '@paralleldrive/cuid2';
import { TaskRepository } from '../repositories/task-repository';
import { Task, createTask } from '../models/task';

export class CreateTaskUsecase {
  private taskRepo: TaskRepository;

  constructor(db: PgDatabase) {
    this.taskRepo = new TaskRepository(db);
  }

  execute(projectId: string, title: string, description?: string): Task {
    const taskData = createTask({ projectId, title, description });
    const now = new Date();

    const task: Task = {
      id: createId(),
      ...taskData,
      createdAt: now,
      updatedAt: now,
    };

    this.taskRepo.upsert(task);
    return task;
  }
}

// usecases/delete-task.ts
import type { PgDatabase } from '../repositories/common';
import { TaskRepository } from '../repositories/task-repository';
import { Task } from '../models/task';

export class DeleteTaskUsecase {
  private taskRepo: TaskRepository;

  constructor(db: PgDatabase) {
    this.taskRepo = new TaskRepository(db);
  }

  execute(taskId: string): void {
    this.taskRepo.delete(Task.ById(taskId));
  }
}

// usecases/get-task.ts
import type { PgDatabase } from '../repositories/common';
import { TaskRepository } from '../repositories/task-repository';
import { Task } from '../models/task';

export class GetTaskUsecase {
  private taskRepo: TaskRepository;

  constructor(db: PgDatabase) {
    this.taskRepo = new TaskRepository(db);
  }

  execute(taskId: string): Task | null {
    return this.taskRepo.get(Task.ById(taskId));
  }
}
```

### SQLを直接使用するケース

複雑なクエリや特殊な操作では、Repositoryを経由せずSQLを直接使用することも可能。

```typescript
// usecases/get-project-summary.ts
import type { PgDatabase } from '../repositories/common';
import { sql, SQL } from '../repositories/sql';
import { Project } from '../models/project';
import { Task } from '../models/task';

interface ProjectSummary {
  project: Project;
  taskCountByStatus: Record<string, number>;
  recentTasks: Task[];
}

export class GetProjectSummaryUsecase {
  constructor(private db: PgDatabase) {}

  execute(projectId: string): ProjectSummary | null {
    // プロジェクト取得
    const projectFragment = sql`
      SELECT * FROM projects WHERE id = ${projectId}
    `;
    const project = this.db.queryGet(projectFragment.sql,
      projectFragment.params) as Record<string, unknown> | null;

    if (!project) return null;

    // ステータス別タスク数
    const countFragment = sql`
      SELECT status, COUNT(*) as count
      FROM tasks
      WHERE project_id = ${projectId}
      GROUP BY status
    `;
    const counts = this.db.queryAll(countFragment.sql,
      countFragment.params) as { status: string; count: number }[];

    // 最近のタスク（上位5件）
    const recentFragment = sql`
      SELECT * FROM tasks
      WHERE project_id = ${projectId}
      ORDER BY created_at DESC
      LIMIT 5
    `;
    const recentTasks = this.db.queryAll(recentFragment.sql,
      recentFragment.params) as Record<string, unknown>[];

    return {
      project: mapProject(project),
      taskCountByStatus: Object.fromEntries(
        counts.map(c => [c.status, c.count])
      ),
      recentTasks: recentTasks.map(mapTask),
    };
  }
}
```
