# ADR-0007: ステップベースUsecase設計

## ステータス

採用 (Accepted)

## 日付

2026-02-28

## コンテキスト

レイヤードアーキテクチャ（ADR-0005）においてUsecase層はビジネスロジックの中心となる。Usecaseの設計パターンを統一し、以下の課題に対応する必要がある：

1. **型安全性**: `let`変数や`!`（非nullアサーション）を排除
2. **エラーハンドリング**: 例外ではなく戻り値でエラーを表現
3. **トランザクション管理**: DBアクセスを含む処理の一貫性保証
4. **可読性**: 処理フローが明確

### 検討した選択肢

#### 選択肢1: クラスベースUsecase

```typescript
class CreateTaskUsecase {
  async execute(input: CreateTaskInput): Promise<Task> {
    const project = await this.projectRepo.get(input.projectId);
    if (!project) throw new NotFoundError('Project not found');

    const task = Task.create(input);
    await this.taskRepo.upsert(task);
    return task;
  }
}
```

**欠点:**
- 例外による制御フローが追いにくい
- `let`変数が必要になりやすい

#### 選択肢2: 関数ベースUsecase（Result型）

```typescript
const createTask = async (input: CreateTaskInput): Promise<Result<Task, Error>> => {
  const project = await projectRepo.get(input.projectId);
  if (!project) return err('NOT_FOUND', 'Project not found');

  const task = Task.create(input);
  await taskRepo.upsert(task);
  return ok(task);
};
```

**欠点:**
- トランザクション管理が散らかりやすい
- 前後処理（ロギング等）の統一が難しい

#### 選択肢3: ステップベースUsecase

```typescript
const createTask = (input: CreateTaskInput) => usecase({
  read: async (ctx, _) => {
    const project = await ctx.repos.project.get(Project.ById(input.projectId));
    if (!project) return fail('NOT_FOUND', 'Project not found');
    return { project };
  },
  write: async (ctx, { project }) => {
    const task = Task.create(input);
    await ctx.repos.task.upsert(task);
    return task;
  },
});
```

## 決定

**ステップベースUsecaseを採用する。**

全Usecaseは`pre → read → process → write → post → result`の6ステップで構成。

## 根拠

1. **`let`と`!`の完全排除**: 各ステップが前ステップの状態を受け取り、新しい状態を返す。型推論により`Fail`が自動除外される。

```typescript
// read の戻り値が { project: Project } | Fail の場合
// process の state は { project: Project } と推論される（Fail除外）
process: async (ctx, state) => {
  // state.project は Project 型（null可能性なし）
  return { ...state, validated: true };
},
```

2. **1 Usecase = 1 Transaction**: `read → process → write`はトランザクション内で実行。

```
pre ─→ [read ─→ process ─→ write] ─→ post ─→ result
        └──── transaction ────┘
```

3. **全ステップ省略可能**: 必要なステップのみ実装。省略時はidentity関数が適用。

```typescript
// 最もシンプルなパターン（readのみ）
const listTasks = (projectId: string) => usecase({
  read: async (ctx, _) => await ctx.repos.task.list(Task.ByProject(projectId)),
});
```

4. **returnベースエラー**: `fail()`を返すと後続ステップはスキップされ、Presentation層に`Result<T, Fail>`として返る。例外を使わない。

```typescript
read: async (ctx, _) => {
  const task = await ctx.repos.task.get(Task.ById(taskId));
  if (!task) return fail('NOT_FOUND', 'Task not found');
  return { task };
},
```

5. **Usecase間呼び出し禁止**: トランザクションのネストを防ぐため、Usecase内から別Usecaseを呼び出さない。共通処理はModelにメソッドを追加。

6. **引数はクロージャ経由**: Usecaseファクトリが引数を受け取り、各ステップはクロージャでキャプチャ。

```typescript
// 引数 taskId, newStatus はクロージャでキャプチャ
const updateTaskStatus = (taskId: string, newStatus: TaskStatus) => usecase({
  read: async (ctx, _) => {
    // taskId にアクセス可能
  },
  process: async (ctx, state) => {
    // newStatus にアクセス可能
  },
});
```

## 結果

### ポジティブ

- `let`変数と`!`を完全排除
- トランザクション境界が明確
- 処理フローが可視化される
- 型推論による安全性
- ロギング（pre/post）とビジネスロジック（read/process/write）の分離

### ネガティブ

- 単純な処理でもステップ形式で書く必要がある
- ステップ間のデータ受け渡しの理解が必要

### 実装詳細

#### Fail型

```typescript
// models/common.ts
const FAIL_BRAND = Symbol.for('auto-kanban.Fail');

export interface Fail {
  readonly [FAIL_BRAND]: true;
  readonly code: string;
  readonly message: string;
}

export function fail(code: string, message: string): Fail {
  return { [FAIL_BRAND]: true, code, message };
}

export function isFail(value: unknown): value is Fail {
  return typeof value === 'object' && value !== null && FAIL_BRAND in value;
}

// Failを除外する型ユーティリティ
export type Unfail<T> = T extends Fail ? never : T;
```

#### Usecaseランナー

```typescript
// usecases/runner.ts
export interface Usecase<T> {
  run(ctx: Context): Promise<Result<T, Fail>>;
}

interface UsecaseDefinition<TPre, TRead, TProcess, TWrite, TPost, TResult> {
  pre?: (ctx: BaseContext) => MaybePromise<TPre | Fail>;
  read?: (ctx: Context, state: Unfail<TPre>) => MaybePromise<TRead | Fail>;
  process?: (ctx: Context, state: Unfail<TRead>) => MaybePromise<TProcess | Fail>;
  write?: (ctx: Context, state: Unfail<TProcess>) => MaybePromise<TWrite | Fail>;
  post?: (ctx: Context, state: Unfail<TWrite>) => MaybePromise<TPost | Fail>;
  result?: (state: Unfail<TPost>) => MaybePromise<TResult>;
}

export function usecase<...>(def: UsecaseDefinition<...>): Usecase<TResult> {
  return {
    async run(ctx: Context): Promise<Result<TResult, Fail>> {
      try {
        let state = await (def.pre?.(ctx) ?? {});
        if (isFail(state)) return { ok: false, error: state };

        state = await (def.read?.(ctx, state) ?? state);
        if (isFail(state)) return { ok: false, error: state };

        state = await (def.process?.(ctx, state) ?? state);
        if (isFail(state)) return { ok: false, error: state };

        state = await (def.write?.(ctx, state) ?? state);
        if (isFail(state)) return { ok: false, error: state };

        state = await (def.post?.(ctx, state) ?? state);
        if (isFail(state)) return { ok: false, error: state };

        const result = await (def.result?.(state) ?? state);
        return { ok: true, value: result };
      } catch (error) {
        return { ok: false, error: fail('INTERNAL', 'An unexpected error occurred') };
      }
    },
  };
}

// 呼び出し方: createTask(input).run(ctx) → Promise<Result<Task, Fail>>
```

#### 使用例

```typescript
// usecases/task/update-status.ts
export const updateTaskStatus = (taskId: string, newStatus: TaskStatus) => usecase({
  read: async (ctx, _) => {
    const task = await ctx.repos.task.get(Task.ById(taskId));
    if (!task) return fail('NOT_FOUND', 'Task not found');
    return { task };
  },
  process: async (ctx, { task }) => {
    if (!canTransition(task.status, newStatus)) {
      return fail('INVALID_TRANSITION', `Cannot transition from ${task.status} to ${newStatus}`);
    }
    return { ...task, status: newStatus, updatedAt: ctx.now };
  },
  write: async (ctx, task) => {
    await ctx.repos.task.upsert(task);
    return task;
  },
  // result省略 → writeの戻り値がそのまま結果
});
```

## 参考資料

- [Railway Oriented Programming](https://fsharpforfunandprofit.com/rop/)
- [ADR-0005: レイヤードアーキテクチャ](./0005-layered-architecture.md)
