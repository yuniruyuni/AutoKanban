# エラーハンドリング戦略

## 概要

Auto Kanbanでは**戻り値ベースのエラーハンドリング**を採用する。例外（throw）ではなく、`Fail`型を返すことでエラーを表現し、型システムによりエラー処理漏れを防ぐ。

---

## 設計原則

### 1. 例外を使わない

```typescript
// 悪い例: 例外
function getTask(id: string): Task {
  const task = db.findTask(id);
  if (!task) throw new NotFoundError('Task not found');
  return task;
}

// 良い例: Fail型
function getTask(id: string): Task | Fail {
  const task = db.findTask(id);
  if (!task) return fail('NOT_FOUND', 'Task not found');
  return task;
}
```

### 2. 型でエラーを追跡

```typescript
// 戻り値の型がエラーの可能性を示す
type Result = Task | Fail;

// 呼び出し側はエラーチェックを強制される
const result = getTask(id);
if (isFail(result)) {
  // エラー処理
  return result;
}
// ここでは result は Task 型
```

### 3. エラーは上位層に伝播

```
┌─────────────────────────────────────────────────────────────┐
│  Presentation Layer                                          │
│    └─ tRPC Error Response に変換                             │
│         ▲                                                    │
│         │ Fail を受け取り HTTP エラーに変換                  │
├─────────┼───────────────────────────────────────────────────┤
│  Usecase Layer                                               │
│    └─ fail() を return して終了                              │
│         ▲                                                    │
│         │ ステップで Fail が返されると後続ステップはスキップ │
├─────────┼───────────────────────────────────────────────────┤
│  Repository Layer                                            │
│    └─ null を返す（見つからない場合）                        │
│         ▲                                                    │
│         │ DB操作の結果                                       │
├─────────┼───────────────────────────────────────────────────┤
│  Model Layer                                                 │
│    └─ バリデーション関数で boolean / Fail を返す            │
└─────────────────────────────────────────────────────────────┘
```

---

## Fail型

### 定義

```typescript
// models/common.ts
const FAIL_BRAND = Symbol.for('auto-kanban.Fail');

export interface Fail {
  readonly [FAIL_BRAND]: true;
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

export function fail(
  code: string,
  message: string,
  details?: Record<string, unknown>
): Fail {
  return {
    [FAIL_BRAND]: true,
    code,
    message,
    details,
  };
}

export function isFail(value: unknown): value is Fail {
  return (
    typeof value === 'object' &&
    value !== null &&
    FAIL_BRAND in value
  );
}

// Failを除外する型ユーティリティ
export type Unfail<T> = T extends Fail ? never : T;
```

### 標準エラーコード

| コード | 意味 | 使用場面 |
|--------|-----|---------|
| `NOT_FOUND` | リソースが見つからない | タスク・プロジェクト取得失敗 |
| `INVALID_INPUT` | 入力が不正 | バリデーション失敗 |
| `INVALID_TRANSITION` | 状態遷移が不正 | ステータス変更失敗 |
| `CONFLICT` | 競合状態 | 同時更新など |
| `DB_ERROR` | データベースエラー | SQL実行失敗 |
| `GIT_ERROR` | Git操作エラー | コミット・ブランチ操作失敗 |
| `INTERNAL` | 内部エラー | 予期しないエラー |

---

## レイヤー別エラーハンドリング

### Model Layer

バリデーション関数でエラーを返す。

```typescript
// models/task.ts
export namespace Task {
  export function canTransition(from: Status, to: Status): boolean {
    const transitions: Record<Status, Status[]> = {
      todo: ['inprogress', 'cancelled'],
      inprogress: ['inreview', 'todo', 'cancelled'],
      inreview: ['done', 'inprogress', 'cancelled'],
      done: [],
      cancelled: [],
    };
    return transitions[from].includes(to);
  }

  export function validateTitle(title: string): Fail | null {
    if (title.length === 0) {
      return fail('INVALID_INPUT', 'Title cannot be empty');
    }
    if (title.length > 200) {
      return fail('INVALID_INPUT', 'Title too long', { maxLength: 200 });
    }
    return null;
  }
}
```

### Repository Layer

見つからない場合は`null`を返す。DB操作エラーは例外として発生する（bun:sqliteの仕様）。

```typescript
// repositories/task-repository.ts
export class TaskRepository {
  get(spec: Comp<Task.Spec>): Task | null {
    const where = compToSQL(spec, taskSpecToSQL);
    const row = this.db.prepare(`
      SELECT * FROM tasks WHERE ${where.sql}
    `).get(...where.params);

    return row ? rowToTask(row) : null;
  }
}
```

### Usecase Layer

`fail()`を返すと後続ステップがスキップされる。

```typescript
// usecases/task/update-status.ts
export const updateTaskStatus = (taskId: string, newStatus: Task.Status) =>
  usecase({
    read: async (ctx, _) => {
      const task = ctx.repos.task.get(Task.ById(taskId));
      if (!task) {
        return fail('NOT_FOUND', 'Task not found', { taskId });
      }
      return { task };
    },

    process: async (ctx, { task }) => {
      if (!Task.canTransition(task.status, newStatus)) {
        return fail('INVALID_TRANSITION', `Cannot transition from ${task.status} to ${newStatus}`, {
          from: task.status,
          to: newStatus,
        });
      }
      return {
        ...task,
        status: newStatus,
        updatedAt: ctx.now,
      };
    },

    write: async (ctx, task) => {
      ctx.repos.task.upsert(task);
      return task;
    },
  });
```

### Presentation Layer

Failをtエラーレスポンスに変換。

```typescript
// presentation/routers/task.ts
import { TRPCError } from '@trpc/server';

const failToTRPCError = (fail: Fail): TRPCError => {
  const codeMap: Record<string, TRPCError['code']> = {
    NOT_FOUND: 'NOT_FOUND',
    INVALID_INPUT: 'BAD_REQUEST',
    INVALID_TRANSITION: 'BAD_REQUEST',
    CONFLICT: 'CONFLICT',
    DB_ERROR: 'INTERNAL_SERVER_ERROR',
    GIT_ERROR: 'INTERNAL_SERVER_ERROR',
    INTERNAL: 'INTERNAL_SERVER_ERROR',
  };

  return new TRPCError({
    code: codeMap[fail.code] ?? 'INTERNAL_SERVER_ERROR',
    message: fail.message,
    cause: fail,
  });
};

export const taskRouter = router({
  updateStatus: publicProcedure
    .input(updateStatusInput)
    .mutation(async ({ input, ctx }) => {
      const result = await updateTaskStatus(input.taskId, input.status).run(ctx);

      if (!result.ok) {
        throw failToTRPCError(result.error);
      }

      return result.value;
    }),
});
```

---

## Result型

Usecaseの実行結果を表現する型。

```typescript
// usecases/runner.ts
export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export interface Usecase<T> {
  run(ctx: Context): Promise<Result<T, Fail>>;
}
```

### 使用例

```typescript
const result = await createTask(input).run(ctx);

if (result.ok) {
  console.log('Created:', result.value);
} else {
  console.error('Failed:', result.error.code, result.error.message);
}
```

---

## Usecaseランナーのエラー処理

```typescript
// usecases/runner.ts
export function usecase<...>(def: UsecaseDefinition<...>): Usecase<TResult> {
  return {
    async run(ctx: Context): Promise<Result<TResult, Fail>> {
      try {
        // pre
        let state = await (def.pre?.(ctx) ?? {});
        if (isFail(state)) return { ok: false, error: state };

        // transaction: read → process → write
        const txResult = ctx.db.transaction(() => {
          state = await (def.read?.(ctx, state) ?? state);
          if (isFail(state)) return { ok: false, error: state };

          state = await (def.process?.(ctx, state) ?? state);
          if (isFail(state)) return { ok: false, error: state };

          state = await (def.write?.(ctx, state) ?? state);
          if (isFail(state)) return { ok: false, error: state };

          return { ok: true, state };
        });

        if (!txResult.ok) return { ok: false, error: txResult.error };
        state = txResult.state;

        // post
        state = await (def.post?.(ctx, state) ?? state);
        if (isFail(state)) return { ok: false, error: state };

        // result
        const result = await (def.result?.(state) ?? state);
        return { ok: true, value: result };

      } catch (error) {
        // 予期しない例外（DB操作エラーなど）
        console.error('Unexpected error:', error);
        return {
          ok: false,
          error: fail('INTERNAL', 'An unexpected error occurred'),
        };
      }
    },
  };
}
```

---

## フロントエンドでのエラー処理

### tRPC + React Query

```typescript
// hooks/useUpdateTaskStatus.ts
import { trpc } from '../trpc';

export function useUpdateTaskStatus() {
  const utils = trpc.useUtils();

  return trpc.task.updateStatus.useMutation({
    onSuccess: (task) => {
      // キャッシュ更新
      utils.task.list.invalidate();
    },
    onError: (error) => {
      // エラー表示
      if (error.data?.code === 'NOT_FOUND') {
        toast.error('タスクが見つかりません');
      } else if (error.data?.code === 'BAD_REQUEST') {
        toast.error(error.message);
      } else {
        toast.error('エラーが発生しました');
      }
    },
  });
}
```

### コンポーネントでの使用

```typescript
function TaskStatusButton({ task }: { task: Task }) {
  const mutation = useUpdateTaskStatus();

  const handleClick = () => {
    mutation.mutate(
      { taskId: task.id, status: 'inprogress' },
      {
        onError: (error) => {
          // 個別のエラー処理
          console.error('Status update failed:', error);
        },
      }
    );
  };

  return (
    <button onClick={handleClick} disabled={mutation.isPending}>
      {mutation.isPending ? '更新中...' : '開始'}
    </button>
  );
}
```

---

## エラーメッセージ

### ユーザー向けメッセージ

```typescript
// presentation/error-messages.ts
export const errorMessages: Record<string, string> = {
  NOT_FOUND: 'リソースが見つかりません',
  INVALID_INPUT: '入力内容に誤りがあります',
  INVALID_TRANSITION: 'この操作は許可されていません',
  CONFLICT: '競合が発生しました。リロードしてください',
  DB_ERROR: 'データベースエラーが発生しました',
  GIT_ERROR: 'Git操作でエラーが発生しました',
  INTERNAL: '予期しないエラーが発生しました',
};

export function getErrorMessage(fail: Fail): string {
  return errorMessages[fail.code] ?? fail.message;
}
```

### 開発者向け詳細

```typescript
// 開発環境でのみ詳細を出力
if (process.env.NODE_ENV === 'development') {
  console.error('Fail details:', {
    code: fail.code,
    message: fail.message,
    details: fail.details,
  });
}
```

---

## テスト

### Fail返却のテスト

```typescript
// usecases/task/update-status.test.ts
import { describe, test, expect, mock } from 'bun:test';

describe('updateTaskStatus', () => {
  test('タスクが存在しない場合はNOT_FOUNDを返す', async () => {
    const ctx = createTestContext();
    ctx.repos.task.get = mock(() => null);

    const result = await updateTaskStatus('non-existent', 'inprogress').run(ctx);

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('NOT_FOUND');
  });

  test('不正な遷移はINVALID_TRANSITIONを返す', async () => {
    const ctx = createTestContext();
    ctx.repos.task.get = mock(() => ({ ...mockTask, status: 'done' }));

    const result = await updateTaskStatus('task-1', 'todo').run(ctx);

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('INVALID_TRANSITION');
  });
});
```

---

## ベストプラクティス

### 1. 早期リターン

```typescript
read: async (ctx, _) => {
  const project = ctx.repos.project.get(Project.ById(projectId));
  if (!project) return fail('NOT_FOUND', 'Project not found');

  const task = ctx.repos.task.get(Task.ById(taskId));
  if (!task) return fail('NOT_FOUND', 'Task not found');

  if (task.projectId !== project.id) {
    return fail('INVALID_INPUT', 'Task does not belong to project');
  }

  return { project, task };
},
```

### 2. 詳細情報の付加

```typescript
return fail('INVALID_TRANSITION', 'Cannot transition status', {
  from: task.status,
  to: newStatus,
  taskId: task.id,
  allowedTransitions: Task.getAllowedTransitions(task.status),
});
```

### 3. エラーの集約

```typescript
// 複数のバリデーションエラーをまとめる
const errors: string[] = [];

if (!title) errors.push('Title is required');
if (!projectId) errors.push('Project ID is required');

if (errors.length > 0) {
  return fail('INVALID_INPUT', 'Validation failed', { errors });
}
```

