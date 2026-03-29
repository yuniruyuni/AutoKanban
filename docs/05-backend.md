# バックエンド構造

## 概要

- **言語**: TypeScript
- **ランタイム**: Bun
- **Webフレームワーク**: Hono
- **API**: tRPC
- **データベース**: PostgreSQL (embedded-postgres) + Raw SQL

## レイヤードアーキテクチャ

![レイヤードアーキテクチャ](./assets/layered-architecture.svg)

## 設計原則

### 1. Model型を中心としたデータフロー

**全レイヤー間のデータ受け渡しはModel型で行う。**

- Presentation → Usecase: Model型で渡す
- Usecase → Repository: Model型で渡す
- Repository → Usecase: Model型で返す
- Usecase → Presentation: Model型で返す

### 2. 各レイヤーの責務

| レイヤー | 入力 | 出力 | 責務 | 外部との関係 |
|---------|------|------|------|-------------|
| Presentation | 外部型（tRPC input） | Model型 | 外部型→Model型変換、Usecase呼び出し | **受動的**（リクエスト受信） |
| Usecase | Model型 | Model型 | ビジネスロジック実行、Repository呼び出し | - |
| Repository | Model型 | Model型 | 外部システム呼び出し（DB、Git、コマンド実行等） | **能動的**（外部呼び出し） |

### 3. Usecaseの制約

- **Usecaseは独自のデータ構造（DTO等）を定義してはならない**
- Model型のみを扱う
- Modelのファクトリ関数・メソッドを呼び出してビジネスロジックを実行
- 複数のRepositoryを組み合わせてトランザクションを管理

## ディレクトリ構造

```
server/
├── src/
│   ├── index.ts              # エントリポイント
│   │
│   ├── presentation/         # Presentation Layer（受動的な外部受信）
│   │   ├── trpc.ts               # tRPC初期化
│   │   ├── context.ts            # コンテキスト（DI）
│   │   ├── websocket.ts          # WebSocket設定
│   │   └── routers/              # tRPCルーター
│   │       ├── index.ts          # App Router
│   │       ├── task.ts
│   │       ├── project.ts
│   │       ├── workspace.ts
│   │       ├── session.ts
│   │       └── config.ts
│   │
│   ├── usecases/             # Usecase Layer
│   │   ├── task/
│   │   │   ├── create-task.ts
│   │   │   ├── update-task.ts
│   │   │   ├── list-tasks.ts
│   │   │   └── delete-task.ts
│   │   ├── project/
│   │   │   ├── create-project.ts
│   │   │   └── list-projects.ts
│   │   ├── workspace/
│   │   │   ├── create-workspace.ts
│   │   │   ├── start-session.ts
│   │   │   └── cleanup-workspace.ts
│   │   └── executor/
│   │       ├── run-agent.ts
│   │       └── abort-agent.ts
│   │
│   ├── repositories/         # Repository Layer（能動的な外部呼び出し）
│   │   ├── common.ts             # compToSQL共通関数
│   │   ├── sql.ts                # SQLオブジェクト（合成可能）
│   │   ├── pagination.ts         # ページネーション（Cursor, Pager, Page）
│   │   ├── database.ts           # DB初期化
│   │   ├── transaction.ts        # トランザクション
│   │   ├── schema.sql            # DDL定義
│   │   ├── task-repository.ts    # DB: Task
│   │   ├── project-repository.ts # DB: Project
│   │   ├── workspace-repository.ts
│   │   ├── session-repository.ts
│   │   ├── execution-process-repository.ts
│   │   ├── git-repository.ts     # 外部: Git操作
│   │   ├── executor-repository.ts # 外部: エージェント実行
│   │   ├── config-repository.ts  # 外部: 設定ファイル読み書き
│   │   └── event-repository.ts   # 外部: EventEmitter
│   │
│   └── models/               # Model Layer
│       ├── common.ts             # Comp<T>ジェネリック型
│       ├── task.ts               # Task + Task.Spec（namespace）
│       ├── project.ts            # Project + Project.Spec
│       ├── workspace.ts          # Workspace + Workspace.Spec
│       ├── session.ts            # Session + Session.Spec
│       ├── execution-process.ts  # ExecutionProcess + ...Spec
│       └── repo.ts               # Repo + Repo.Spec
│
└── package.json
```

---

## Model Layer

ドメインモデルを定義。全レイヤーで共有される言語。
ビジネスルールはModelのメソッド・関数として実装。
**namespaceで関連型（Spec, Statusなど）を組織化**。

### 共通型

```typescript
// models/common.ts

/** Specification Composition */
export type Comp<T> =
  | T
  | { type: 'and'; children: Comp<T>[] }
  | { type: 'or'; children: Comp<T>[] }
  | { type: 'not'; child: Comp<T> };

/** Comp用ヘルパー */
export const and = <T>(...children: Comp<T>[]): Comp<T> => ({ type: 'and', children });
export const or = <T>(...children: Comp<T>[]): Comp<T> => ({ type: 'or', children });
export const not = <T>(child: Comp<T>): Comp<T> => ({ type: 'not', child });

/** Spec定義ヘルパー（type を自動付与） */
export function defineSpecs<T extends Record<string, (...args: never[]) => object>>(specs: T): {
  [K in keyof T & string]: (...args: Parameters<T[K]>) => ReturnType<T[K]> & { type: K }
} { /* 実装省略 */ }

/** オブジェクトからSpec型のみ抽出 */
export type SpecsOf<T> = {
  [K in keyof T]: T[K] extends (...args: never[]) => infer R
    ? R extends { type: string } ? R : never
    : never
}[keyof T];
```

### Task Model

```typescript
// models/task.ts
import { defineSpecs, type SpecsOf } from './common';

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
  ByTitleContains: (keyword: string) => ({ keyword }),
});

export namespace Task {
  export type Status = 'todo' | 'inprogress' | 'inreview' | 'done' | 'cancelled';
  export type Spec = SpecsOf<typeof Task>;
}

// 使用: Task.ById('...'), Task.Status, Comp<Task.Spec>
```

### Project Model

```typescript
// models/project.ts
import { defineSpecs, type SpecsOf } from './common';

export type Project = {
  id: string;
  name: string;
  devScript: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export const Project = defineSpecs({
  ById: (id: string) => ({ id }),
  ByNameContains: (keyword: string) => ({ keyword }),
});

export namespace Project {
  export type Spec = SpecsOf<typeof Project>;
}
```

### Workspace Model

```typescript
// models/workspace.ts
import { defineSpecs, type SpecsOf } from './common';

export type Workspace = {
  id: string;
  taskId: string;
  containerRef: string;
  setupComplete: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export const Workspace = defineSpecs({
  ById: (id: string) => ({ id }),
  ByTask: (taskId: string) => ({ taskId }),
});

export namespace Workspace {
  export type Spec = SpecsOf<typeof Workspace>;
}
```

### Session Model

```typescript
// models/session.ts
import { defineSpecs, type SpecsOf } from './common';

export type Session = {
  id: string;
  workspaceId: string;
  executor: Session.Executor | null;
  createdAt: Date;
  updatedAt: Date;
};

export const Session = defineSpecs({
  ById: (id: string) => ({ id }),
  ByWorkspace: (workspaceId: string) => ({ workspaceId }),
});

export namespace Session {
  export type Executor = 'CLAUDE_CODE' | 'GEMINI' | 'CODEX' | 'AMP' | 'CURSOR_AGENT' | 'COPILOT';
  export type Spec = SpecsOf<typeof Session>;
}
```

### ExecutionProcess Model

```typescript
// models/execution-process.ts
import { defineSpecs, type SpecsOf } from './common';

export type ExecutionProcess = {
  id: string;
  sessionId: string;
  runReason: ExecutionProcess.RunReason;
  status: ExecutionProcess.Status;
  exitCode: number | null;
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export const ExecutionProcess = defineSpecs({
  ById: (id: string) => ({ id }),
  BySession: (sessionId: string) => ({ sessionId }),
  ByStatus: (status: ExecutionProcess.Status) => ({ status }),
});

export namespace ExecutionProcess {
  export type RunReason = 'setupscript' | 'codingagent' | 'devserver' | 'cleanupscript';
  export type Status = 'running' | 'completed' | 'failed' | 'killed';
  export type Spec = SpecsOf<typeof ExecutionProcess>;
}
```

---

## Repository Layer

**能動的な外部とのやり取り**を担当。アプリケーションから外部システム（DB、Git、コマンド実行等）へ能動的に呼び出す。

### 設計原則

- **1 Model = 1 Repository**: 各Modelに対応するRepositoryが1つ存在
- **SQL直接使用**: JOINなど複雑なクエリに対応するため
- **SpecificationはModel層**: `models/xxx/spec.ts`で定義
- **共通変換関数**: `repositories/common.ts`で`and`/`or`/`not`処理を共通化
- **基本Spec変換は各Repository**: 各Repositoryが`xxxSpecToSQL`を提供
- **標準メソッド**: DBアクセスRepositoryは以下を持つ
  - `list(spec, cursor): Page<Model>`
  - `get(spec): Model | null`
  - `upsert(model): void`
  - `delete(spec): void`
  - `count(spec): number`

### Comp<T>とSpecification

```typescript
// models/common.ts - 合成用
export type Comp<T> = T | { type: 'and'; children: Comp<T>[] } | ...;
export const and = <T>(...children: Comp<T>[]): Comp<T> => ({ type: 'and', children });

// models/task.ts - defineSpecsで関数定義、SpecsOfで型導出
export const Task = defineSpecs({
  ById: (id: string) => ({ id }),
  ByProject: (projectId: string) => ({ projectId }),
  ByStatuses: (...statuses: Task.Status[]) => ({ statuses }),
});
export namespace Task {
  export type Spec = SpecsOf<typeof Task>;
}

// 使用: Task.ById('...'), and(Task.ByProject(...), Task.ByStatuses(...))
```

### 共通変換関数（Repository層）

```typescript
// repositories/common.ts
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

### DBアクセスRepository例

```typescript
// repositories/task-repository.ts
import { sql, SQL } from './sql';
import { compToSQL } from './common';
import type { Comp } from '../models/common';
import { Task } from '../models/task';

// 基本Spec→SQL変換（Task固有）
function taskSpecToSQL(spec: Task.Spec): SQL {
  switch (spec.type) {
    case 'ById':
      return sql`id = ${spec.id}`;
    case 'ByProject':
      return sql`project_id = ${spec.projectId}`;
    case 'ByStatuses':
      return sql`status IN (${sql.params(...spec.statuses)})`;
  }
}

export class TaskRepository {
  // Comp<Task.Spec>を受け取る
  list(spec: Comp<Task.Spec>, cursor: Cursor): Page<Task> {
    const where = compToSQL(spec, taskSpecToSQL);
    // ...
  }
}

// 使用例
taskRepo.get(Task.ById('task-123'));  // 単一条件
taskRepo.list(                         // 合成条件
  and(Task.ByProject('proj-1'), Task.ByStatuses('todo', 'inprogress')),
  cursor
);
```

### 外部システム: GitRepository

Git操作を抽象化するリポジトリ。

```typescript
// repositories/git-repository.ts
import { $ } from 'bun';

export interface WorktreeOptions {
  repoPath: string;
  worktreePath: string;
  branch: string;
  baseBranch?: string;
}

export interface GitRepository {
  createWorktree(options: WorktreeOptions): Promise<void>;
  removeWorktree(options: WorktreeOptions): Promise<void>;
  diff(repoPath: string, from: string, to?: string): Promise<string>;
  currentBranch(repoPath: string): Promise<string>;
  headCommit(repoPath: string): Promise<string>;
  merge(repoPath: string, branch: string): Promise<{ success: boolean; mergeCommit?: string }>;
}

export class GitRepositoryImpl implements GitRepository {
  async createWorktree(options: WorktreeOptions): Promise<void> {
    const { repoPath, worktreePath, branch, baseBranch = 'main' } = options;
    await $`git -C ${repoPath} branch ${branch} ${baseBranch}`.quiet();
    await $`git -C ${repoPath} worktree add ${worktreePath} ${branch}`.quiet();
  }

  async removeWorktree(options: WorktreeOptions): Promise<void> {
    const { repoPath, worktreePath, branch } = options;
    await $`git -C ${repoPath} worktree remove ${worktreePath} --force`.quiet();
    await $`git -C ${repoPath} branch -D ${branch}`.quiet();
  }

  async diff(repoPath: string, from: string, to = 'HEAD'): Promise<string> {
    return await $`git -C ${repoPath} diff ${from}..${to}`.text();
  }

  async currentBranch(repoPath: string): Promise<string> {
    const result = await $`git -C ${repoPath} branch --show-current`.text();
    return result.trim();
  }

  async headCommit(repoPath: string): Promise<string> {
    const result = await $`git -C ${repoPath} rev-parse HEAD`.text();
    return result.trim();
  }

  async merge(repoPath: string, branch: string): Promise<{ success: boolean; mergeCommit?: string }> {
    try {
      await $`git -C ${repoPath} merge ${branch}`.quiet();
      const mergeCommit = await this.headCommit(repoPath);
      return { success: true, mergeCommit };
    } catch {
      return { success: false };
    }
  }
}
```

### 外部システム: ExecutorRepository

AIエージェント実行を抽象化するリポジトリ。

```typescript
// repositories/executor-repository.ts
import { spawn, type Subprocess } from 'bun';
import { EventEmitter } from 'events';
import type { Executor } from '../models/session';

export interface ExecutorConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface StartOptions {
  executionProcessId: string;
  executor: Executor;
  workingDir: string;
  prompt: string;
}

export interface ExecutorRepository {
  start(options: StartOptions): Promise<void>;
  sendMessage(id: string, message: string): Promise<void>;
  abort(id: string): Promise<void>;
  onLog(id: string, callback: (chunk: string) => void): () => void;
  onExit(id: string, callback: (exitCode: number) => void): () => void;
}

const EXECUTOR_CONFIGS: Record<Executor, ExecutorConfig> = {
  CLAUDE_CODE: {
    command: 'claude',
    args: ['--print', '--output-format', 'stream-json'],
  },
  GEMINI: {
    command: 'gemini',
    args: [],
  },
  CODEX: {
    command: 'codex',
    args: [],
  },
  AMP: {
    command: 'amp',
    args: [],
  },
  CURSOR_AGENT: {
    command: 'cursor',
    args: ['--agent'],
  },
  COPILOT: {
    command: 'gh',
    args: ['copilot'],
  },
};

export class ExecutorRepositoryImpl implements ExecutorRepository {
  private processes = new Map<string, Subprocess>();
  private events = new EventEmitter();

  async start(options: StartOptions): Promise<void> {
    const config = EXECUTOR_CONFIGS[options.executor];

    const proc = spawn({
      cmd: [config.command, ...config.args, options.prompt],
      cwd: options.workingDir,
      env: { ...process.env, ...config.env },
      stdout: 'pipe',
      stderr: 'pipe',
      stdin: 'pipe',
    });

    this.processes.set(options.executionProcessId, proc);
    this.streamOutput(options.executionProcessId, proc);

    proc.exited.then((exitCode) => {
      this.events.emit(`exit:${options.executionProcessId}`, exitCode);
      this.processes.delete(options.executionProcessId);
    });
  }

  private async streamOutput(id: string, proc: Subprocess): Promise<void> {
    const reader = proc.stdout.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      this.events.emit(`log:${id}`, decoder.decode(value));
    }
  }

  async sendMessage(id: string, message: string): Promise<void> {
    const proc = this.processes.get(id);
    if (!proc?.stdin) throw new Error('Process not found');

    const writer = proc.stdin.getWriter();
    await writer.write(new TextEncoder().encode(message + '\n'));
    writer.releaseLock();
  }

  async abort(id: string): Promise<void> {
    const proc = this.processes.get(id);
    if (proc) {
      proc.kill('SIGTERM');
    }
  }

  onLog(id: string, callback: (chunk: string) => void): () => void {
    this.events.on(`log:${id}`, callback);
    return () => this.events.off(`log:${id}`, callback);
  }

  onExit(id: string, callback: (exitCode: number) => void): () => void {
    this.events.on(`exit:${id}`, callback);
    return () => this.events.off(`exit:${id}`, callback);
  }
}
```

---

## Usecase Layer

ビジネスロジックを実行。1ユースケース = 1トランザクション。

### 設計原則

- **ステップベース**: 全usecaseは`pre → read → process → write → post → result`の6ステップで構成
- **全ステップ非同期**: 全ステップは`Promise<T>`を返す（async/await対応）
- **統一シグネチャ**: `pre`は`(ctx) => Promise<state>`、他は`(ctx, state) => Promise<newState>`の形式
- **クロージャで引数**: usecaseは関数でラップし、引数はクロージャ経由でアクセス
- **オプショナルステップ**: 不要なステップは省略可能（自動的にidentity関数が適用）
- **型推論**: 各ステップの戻り値型が次のステップの入力型として自動推論
- **returnベースエラー**: `fail()`でエラーを返すと後続ステップはスキップされる
- **1 usecase = 1 transaction**: read → process → write はトランザクション内で実行
- **usecase間呼び出し禁止**: usecase内から別のusecaseを呼び出してはならない（共通処理はModelに）
- **`let`/`!`禁止**: ステップ間の状態受け渡しにより完全に排除
- **Model型のみ**: 独自のDTO等を定義しない

### 共通定義

```typescript
// usecases/common.ts

// === Context Types ===
// システム全体で共通の基本コンテキスト
type BaseContext = {
  now: Date;      // usecase呼び出し時点の時刻（全ステップで同一）
  logger: Logger; // ロガー
};

type Logger = {
  debug: (message: string, meta?: object) => void;
  info: (message: string, meta?: object) => void;
  warn: (message: string, meta?: object) => void;
  error: (message: string, meta?: object) => void;
};

// 各ステップのコンテキスト
type PreContext = BaseContext;
type ReadContext = BaseContext & { repos: ReadOnlyRepos };
type ProcessContext = BaseContext;  // now, logger のみ（純粋計算 + 時刻参照）
type WriteContext = BaseContext & { repos: AllRepos };
type PostContext = BaseContext;

// === Steps型（全ステップ非同期、全ステップ必須） ===
// pre: 最初のステップ（state引数なし、引数はクロージャで渡す）
// read以降: 前ステップの state を受け取る（Fail は自動除外）
type Steps<TPre, TRead, TProcess, TWrite, TPost, TOutput> = {
  pre: (ctx: PreContext) => Promise<TPre>;
  read: (ctx: ReadContext, state: Unfail<TPre>) => Promise<TRead>;
  process: (ctx: ProcessContext, state: Unfail<TRead>) => Promise<TProcess>;
  write: (ctx: WriteContext, state: Unfail<TProcess>) => Promise<TWrite>;
  post: (ctx: PostContext, state: Unfail<TWrite>) => Promise<TPost>;
  result: (state: Unfail<TPost>) => Promise<TOutput>;
};

// === skip関数（内部用identity、非同期） ===
const skip = async <T>(_ctx: unknown, state: T): Promise<T> => state;
const skipPre = async (_ctx: PreContext): Promise<undefined> => undefined;

// 内部用: 省略されたステップかどうかの判定
function isSkip(fn: Function): boolean {
  return fn === skip || fn === skipPre;
}

// === Fail 型（returnベースのエラーハンドリング） ===
// throwではなくreturnでエラーを返す
// unique symbol でブランド化（ユーザー定義型との衝突を防ぐ）
declare const FailSymbol: unique symbol;

type Fail = {
  readonly [FailSymbol]: true;
  readonly code: string;
  readonly message: string;
};

export const fail = (code: string, message: string): Fail => ({
  [FailSymbol as typeof FailSymbol]: true,
  code,
  message,
});

// Fail を除外する型ヘルパー
type Unfail<T> = T extends { [FailSymbol]: true } ? never : T;

// Fail 判定
function isFail(value: unknown): value is Fail {
  return (
    typeof value === 'object' &&
    value !== null &&
    FailSymbol in value
  );
}

// === 結果型 ===
export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// === usecase ヘルパー（全ステップオプショナル、非同期、returnベースエラー） ===
// 注: NoInfer は Unfail との組み合わせで条件型の分配が正しく動作しないため使用しない

export function usecase<
  TPre = undefined,  // pre省略時は undefined
  TRead = TPre,      // デフォルトは前ステップの型をそのまま継承
  TProcess = TRead,
  TWrite = TProcess,
  TPost = TWrite,
  TOutput = TPost
>(steps: {
  pre?: (ctx: PreContext) => Promise<TPre>;
  read?: (ctx: ReadContext, state: Unfail<TPre>) => Promise<TRead>;
  process?: (ctx: ProcessContext, state: Unfail<TRead>) => Promise<TProcess>;
  write?: (ctx: WriteContext, state: Unfail<TProcess>) => Promise<TWrite>;
  post?: (ctx: PostContext, state: Unfail<TWrite>) => Promise<TPost>;
  result?: (state: Unfail<TPost>) => Promise<TOutput>;
}): Steps<TPre, TRead, TProcess, TWrite, TPost, TOutput> {
  return {
    pre: steps.pre ?? skipPre,
    read: steps.read ?? skip,
    process: steps.process ?? skip,
    write: steps.write ?? skip,
    post: steps.post ?? skip,
    result: steps.result ?? (async (state) => state as unknown as TOutput),
  } as Steps<TPre, TRead, TProcess, TWrite, TPost, TOutput>;
}
```

### Usecaseランナー

`usecase()` は `Usecase<T>` オブジェクトを返す。`.run(ctx)` で実行し `Result<T, Fail>` を得る。

```typescript
// usecases/runner.ts
export interface Usecase<T> {
  run(ctx: Context): Promise<Result<T, Fail>>;
}

export function usecase<...>(def: UsecaseDefinition<...>): Usecase<TResult> {
  return {
    async run(ctx: Context): Promise<Result<TResult, Fail>> {
      try {
        // pre（トランザクション外）
        let state = await (def.pre?.(ctx) ?? {});
        if (isFail(state)) return { ok: false, error: state };

        // read → process → write
        state = await (def.read?.(ctx, state) ?? state);
        if (isFail(state)) return { ok: false, error: state };

        state = await (def.process?.(ctx, state) ?? state);
        if (isFail(state)) return { ok: false, error: state };

        state = await (def.write?.(ctx, state) ?? state);
        if (isFail(state)) return { ok: false, error: state };

        // post（トランザクション外）
        state = await (def.post?.(ctx, state) ?? state);
        if (isFail(state)) return { ok: false, error: state };

        // result
        const result = await (def.result?.(state) ?? state);
        return { ok: true, value: result };
      } catch (error) {
        return { ok: false, error: fail('INTERNAL', 'An unexpected error occurred') };
      }
    },
  };
}
```

**呼び出し方**: `createTask(input).run(ctx)` → `Promise<Result<Task, Fail>>`

### タスク作成

```typescript
// usecases/task/create-task.ts
import { usecase, fail } from '../common';
import { Task } from '../../models/task';
import { Project } from '../../models/project';

export const createTask = (task: Task) => usecase({
  pre: async (ctx) => {
    ctx.logger.info('Creating task', { title: task.title });
    return { startTime: ctx.now };
  },
  read: async (ctx, { startTime }) => {
    const project = await ctx.repos.project.get(Project.ById(task.projectId));
    if (!project) return fail('NOT_FOUND', 'Project not found');
    return { project, startTime };
  },
  write: async (ctx, state) => {
    // state の型は { project: Project, startTime: Date }（Fail は自動除外）
    await ctx.repos.task.upsert(task);
    return task;
  },
  post: async (ctx, task) => {
    ctx.logger.info('Task created', { taskId: task.id });
    return task;
  },
});
```

### タスクステータス更新（ビジネスルール適用）

```typescript
// usecases/task/update-task-status.ts
import { usecase, fail } from '../common';
import { Task, canTransitionStatus } from '../../models/task';

export const updateTaskStatus = (taskId: string, newStatus: Task.Status) => usecase({
  read: async (ctx, _) => {
    const task = await ctx.repos.task.get(Task.ById(taskId));
    if (!task) return fail('NOT_FOUND', 'Task not found');
    return { task };
  },
  process: async (ctx, { task }) => {
    // state の型は { task: Task }（Fail は自動除外）
    // ctx.now で現在時刻を参照（usecase呼び出し時点で固定）
    if (!canTransitionStatus(task.status, newStatus)) {
      return fail('INVALID_TRANSITION', `Cannot transition from ${task.status} to ${newStatus}`);
    }
    return { ...task, status: newStatus, updatedAt: ctx.now };
  },
  write: async (ctx, task) => {
    // state の型は Task
    await ctx.repos.task.upsert(task);
    return task;
  },
  // result 省略 → Task がそのまま結果
});
```

### タスク一覧取得

```typescript
// usecases/task/list-tasks.ts
import { usecase } from '../common';
import { and } from '../../models/common';
import { Task } from '../../models/task';
import type { Cursor, Page } from '../../repositories/pagination';

export const listTasks = (
  projectId: string,
  statuses: Task.Status[] | undefined,
  cursor: Cursor<Task.SortKey>
) => usecase({
  // readのみ必要、result も省略可（状態をそのまま返す場合）
  read: async (ctx, _) => {
    const spec = statuses && statuses.length > 0
      ? and(Task.ByProject(projectId), Task.ByStatuses(...statuses))
      : Task.ByProject(projectId);
    return await ctx.repos.task.list(spec, cursor);
    // 戻り値型 Page<Task> がそのまま TOutput になる
  },
});
```

### 条件分岐パターン

```typescript
// usecases/task/update-task-if-active.ts
import { usecase, fail } from '../common';
import { Task } from '../../models/task';

export const updateTaskIfActive = (taskId: string, updates: Partial<Task>) => usecase({
  read: async (ctx, _) => {
    const task = await ctx.repos.task.get(Task.ById(taskId));
    if (!task) return fail('NOT_FOUND', 'Task not found');
    return { task, shouldUpdate: task.status !== 'done' };
  },
  process: async (ctx, { task, shouldUpdate }) => {
    if (!shouldUpdate) return task;  // 完了済みならそのまま返す
    return { ...task, ...updates, updatedAt: ctx.now };
  },
  write: async (ctx, task) => {
    await ctx.repos.task.upsert(task);
    return task;
  },
});
```

### ロギング付きユースケース

```typescript
// usecases/task/create-task-with-audit.ts
import { usecase, fail } from '../common';
import { Task } from '../../models/task';
import { Project } from '../../models/project';

export const createTaskWithAudit = (task: Task) => usecase({
  pre: async (ctx) => {
    ctx.logger.info('Creating task', { projectId: task.projectId, title: task.title });
    return { startTime: ctx.now };  // ctx.now で時刻を取得
  },
  read: async (ctx, { startTime }) => {
    // state の型は { startTime: Date }
    const project = await ctx.repos.project.get(Project.ById(task.projectId));
    if (!project) return fail('NOT_FOUND', 'Project not found');
    return { project, startTime };
  },
  write: async (ctx, state) => {
    // state の型は { project: Project, startTime: Date }（Fail 除外済み）
    await ctx.repos.task.upsert(task);
    return { ...state, savedAt: ctx.now };
  },
  post: async (ctx, state) => {
    ctx.logger.info('Task created', {
      taskId: task.id,
      duration: state.savedAt.getTime() - state.startTime.getTime()
    });
    return state;
  },
  result: async () => task,
});
```

### 純粋計算のみのユースケース

```typescript
// usecases/price/calculate-price.ts
import { usecase } from '../common';

type CartItem = { price: number; quantity: number };

export const calculatePrice = (items: CartItem[]) => usecase({
  // processのみ必要（純粋計算、DB不要）
  // result も省略可 - process の戻り値がそのまま結果になる
  process: async (ctx, _state) => {
    // ctx.now で計算時刻を取得可能
    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const tax = subtotal * 0.1;
    const total = subtotal + tax;
    return { subtotal, tax, total, calculatedAt: ctx.now };
  },
});
```

### ステップ間の型の流れ

```
(引数) ─closure─→ pre ─→ TPre ─read─→ TRead ─process─→ TProcess ─write─→ TWrite ─post─→ TPost ─result─→ TOutput
                   ↑          ↑               ↑              ↑             ↑              ↑
                 省略可     省略可          省略可         省略可        省略可         省略可
                                                                                       (=TPost)
```

| ステップ | 入力 | 出力状態 | 実行場所 | 目的 |
|---------|------|---------|---------|------|
| pre | なし（引数はクロージャ経由） | `Promise<TPre>` | TX外 | ロギング、計測開始 |
| read | `Unfail<TPre>` | `Promise<TRead>` | TX内 | DB読み取り |
| process | `Unfail<TRead>` | `Promise<TProcess>` | TX内 | 純粋計算、検証（`ctx.now`で時刻参照可） |
| write | `Unfail<TProcess>` | `Promise<TWrite>` | TX内 | DB書き込み |
| post | `Unfail<TWrite>` | `Promise<TPost>` | TX外 | ロギング、計測終了 |
| result | `Unfail<TPost>` | `Promise<TOutput>` | TX外 | 最終出力の抽出（省略時は`TPost`をそのまま返す） |

**注**: `Unfail<T>`により、前ステップが`Fail`を返した場合は自動的に除外され、後続ステップには渡らない。

### 禁止パターン

```typescript
// ❌ Usecase内から別のUsecaseを呼び出してはいけない
// 共通処理が必要ならModelにメソッドを追加する
export const badPattern = () => usecase({
  read: async (ctx, _) => {
    // ❌ 別のusecaseを呼び出すのは禁止
    // const result = await runUsecase(ctx, otherUsecase());
    // 代わりにModelのメソッドを使う
    return await ctx.repos.task.list(Task.All());
  },
});

// ❌ resultでFailを返すのは非推奨（許可はされる）
// const badPattern = () => usecase({
//   result: async (state) => {
//     if (!state.valid) return fail('INVALID', '...');  // 非推奨
//     return state;
//   },
// });
```

### テスト戦略

- **単体テスト**: 各usecaseに対してテストを記述
- **DB**: テストごとに独立したPostgreSQLインスタンス（実際のDBを使用）
- **外部サービス**: サービスレベルでモック
- **トランザクション**: 1 usecase = 1 transaction が保証される

---

## Presentation Layer

**受動的な外部とのやり取り**を担当。外部（Frontend等）からのリクエストを受け付け、応答を返す。tRPCハンドラーとして入力検証、外部型→Model型変換、usecaseランナー呼び出しを行う。

### コンテキスト定義

```typescript
// presentation/context.ts
import { PgDatabase } from '../db/pg-client';
import { initializeDatabase } from '../repositories/database';
import { GitRepositoryImpl } from '../repositories/git-repository';
import { ExecutorRepositoryImpl } from '../repositories/executor-repository';
import { Logger } from '../logger';

let db: PgDatabase | null = null;

export async function createContext() {
  if (!db) {
    db = await initializeDatabase();
  }

  return {
    db,
    logger: new Logger(),
    gitRepo: new GitRepositoryImpl(),
    executorRepo: new ExecutorRepositoryImpl(),
  };
}

export type Context = ReturnType<typeof createContext>;
```

### タスクルーター

```typescript
// presentation/routers/task.ts
import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { createTask } from '../../usecases/task/create-task';
import { listTasks } from '../../usecases/task/list-tasks';
import { updateTask } from '../../usecases/task/update-task';
import { deleteTask } from '../../usecases/task/delete-task';

const TaskStatusSchema = z.enum(['todo', 'inprogress', 'inreview', 'done', 'cancelled']);

export const taskRouter = router({
  list: publicProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      status: TaskStatusSchema.optional(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(({ ctx, input }) => listTasks(input).run(ctx)),

  create: publicProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      title: z.string().min(1),
      description: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => createTask(input).run(ctx)),

  update: publicProcedure
    .input(z.object({
      taskId: z.string().uuid(),
      title: z.string().min(1).optional(),
      description: z.string().optional(),
      status: TaskStatusSchema.optional(),
    }))
    .mutation(({ ctx, input }) => updateTask(input).run(ctx)),

  delete: publicProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .mutation(({ ctx, input }) => deleteTask(input).run(ctx)),
});
```

### App Router

```typescript
// presentation/routers/index.ts
import { router } from '../trpc';
import { taskRouter } from './task';
import { projectRouter } from './project';
import { workspaceRouter } from './workspace';
import { configRouter } from './config';

export const appRouter = router({
  task: taskRouter,
  project: projectRouter,
  workspace: workspaceRouter,
  config: configRouter,
});

export type AppRouter = typeof appRouter;
```

---

## エントリポイント

```typescript
// index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/bun';
import { trpcServer } from '@hono/trpc-server';
import { appRouter } from './routers';
import { createContext } from './context';

const app = new Hono();

// CORS設定
app.use('/trpc/*', cors());

// tRPCルート
app.use(
  '/trpc/*',
  trpcServer({
    router: appRouter,
    createContext,
  })
);

// 静的ファイル（フロントエンドビルド）
app.use('/*', serveStatic({ root: './public' }));

// サーバー起動
const server = Bun.serve({
  port: process.env.PORT || 3000,
  fetch: app.fetch,
});

console.log(`Server running on http://localhost:${server.port}`);
```

---

## Bunの活用

### シェルスクリプト実行

```typescript
import { $ } from 'bun';

// セットアップスクリプト実行
async function runSetupScript(script: string, cwd: string): Promise<void> {
  await $`sh -c ${script}`.cwd(cwd).quiet();
}
```

### ファイル操作

```typescript
// ファイル読み取り
const content = await Bun.file('path/to/file').text();

// ファイル書き込み
await Bun.write('path/to/file', content);

// JSONファイル
const data = await Bun.file('config.json').json();
```

### プロセス起動

```typescript
import { spawn } from 'bun';

const proc = spawn({
  cmd: ['claude', '--print'],
  cwd: '/path/to/workspace',
  stdout: 'pipe',
  stderr: 'pipe',
  stdin: 'pipe',
});

// 出力読み取り
for await (const chunk of proc.stdout) {
  console.log(new TextDecoder().decode(chunk));
}

// 終了待機
const exitCode = await proc.exited;
```

---

## package.json

```json
{
  "name": "@auto-kanban/server",
  "type": "module",
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "build": "bun build src/index.ts --outdir dist --target bun",
    "start": "bun run dist/index.js",
    "test": "bun test"
  },
  "dependencies": {
    "@hono/trpc-server": "^0.4.2",
    "@paralleldrive/cuid2": "^3.3.0",
    "@trpc/server": "^11.10.0",
    "hono": "^4.12.0",
    "zod": "^4.3.0"
  },
  "devDependencies": {
    "@types/bun": "latest"
  }
}
```

---

## 開発コマンド

```bash
# 開発サーバー起動（ホットリロード）
bun run start:dev

# 本番ビルド
bun run build

# 本番サーバー起動
bun run start:prod

# 型チェック
bun run tsc --noEmit

# テスト
bun run check:test
```

---

## ビルドとデプロイ

### シングルバイナリ生成

```bash
# フロントエンドビルド
cd client && bun run build

# 静的ファイルをサーバーにコピー
cp -r client/dist server/public

# シングルバイナリ生成
bun build server/src/index.ts \
  --compile \
  --outfile dist/auto-kanban \
  --target bun
```

### 実行

```bash
# Bunのインストール不要で実行可能
./dist/auto-kanban

# 環境変数指定
PORT=8080 ./dist/auto-kanban
```
