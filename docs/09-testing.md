# テスト戦略

## 概要

- **テストフレームワーク**: bun:test
- **方針**: 各レイヤーの責務に応じたテスト
- **カバレッジ目標**: コアロジック（Usecase、Model）を重点的にテスト

## テストピラミッド

```
          ┌─────────────┐
          │    E2E      │  少数
          ├─────────────┤
          │ Integration │  中程度
          ├─────────────┤
          │    Unit     │  多数
          └─────────────┘
```

本プロジェクトでは、個人利用のシンプルなアプリケーションであるため、**Unit + Integration**を中心にテストを構成する。

---

## レイヤー別テスト方針

### Model Layer

**方針**: ビジネスロジックの純粋関数をテスト

```typescript
// models/task.test.ts
import { describe, test, expect } from 'bun:test';
import { Task } from './task';

describe('Task', () => {
  describe('create', () => {
    test('デフォルトステータスはtodo', () => {
      const task = Task.create({
        projectId: 'proj-1',
        title: 'Test Task',
      });
      expect(task.status).toBe('todo');
    });
  });

  describe('canTransition', () => {
    test('todo → inprogress は許可', () => {
      expect(Task.canTransition('todo', 'inprogress')).toBe(true);
    });

    test('done → todo は不許可', () => {
      expect(Task.canTransition('done', 'todo')).toBe(false);
    });
  });

  describe('cursor', () => {
    test('ソートキーの値を抽出する', () => {
      const task: Task = {
        id: 'task-1',
        projectId: 'proj-1',
        title: 'Test',
        description: null,
        status: 'todo',
        createdAt: new Date('2025-01-01T00:00:00Z'),
        updatedAt: new Date('2025-01-02T00:00:00Z'),
      };

      const cursor = Task.cursor(task, ['createdAt', 'id']);
      expect(cursor).toEqual({
        createdAt: '2025-01-01T00:00:00.000Z',
        id: 'task-1',
      });
    });
  });
});
```

**テスト対象:**
- ファクトリ関数（`Task.create`等）
- ビジネスルール関数（`canTransition`等）
- カーソル生成（`cursor`）
- Specification定義（型レベルで検証）

### Repository Layer

**方針**: 実際のDBを使用したIntegration Test

```typescript
// repositories/task/postgres/index.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { TaskRepositoryPostgres } from './index';
import { Task } from '../../../models/task';
import { and } from '../../../models/common';
import type { DbReadCtx, DbWriteCtx } from '../../common';
// embedded-postgresでテスト用DBを起動
// テストファイルは実装の隣に配置

describe('TaskRepositoryPostgres', () => {
  // テスト用のembedded-postgres DB接続を利用
  let readCtx: DbReadCtx;
  let writeCtx: DbWriteCtx;
  let repo: TaskRepositoryPostgres;

  beforeAll(async () => {
    // embedded-postgresでテスト用DB起動・スキーマ適用
    // ... setup省略
    repo = new TaskRepositoryPostgres();
  });

  afterAll(async () => {
    // DB接続クローズ
  });

  describe('upsert', () => {
    test('新規タスクを挿入できる', async () => {
      const task = Task.create({ projectId: 'proj-1', title: 'Test' });
      await repo.upsert(writeCtx, task);

      const found = await repo.get(readCtx, Task.ById(task.id));
      expect(found).not.toBeNull();
      expect(found!.title).toBe('Test');
    });
  });

  describe('list', () => {
    test('プロジェクトIDでフィルタリングできる', async () => {
      await repo.upsert(writeCtx, Task.create({ projectId: 'proj-1', title: 'Task 1' }));
      await repo.upsert(writeCtx, Task.create({ projectId: 'proj-2', title: 'Task 2' }));

      const cursor = { limit: 10, sort: Task.defaultSort };
      const page = await repo.list(readCtx, Task.ByProject('proj-1'), cursor);

      expect(page.items).toHaveLength(1);
      expect(page.items[0].title).toBe('Task 1');
    });

    test('複合条件でフィルタリングできる', async () => {
      await repo.upsert(writeCtx, Task.create({ projectId: 'proj-1', title: 'Task 1' }));
      const task2 = Task.create({ projectId: 'proj-1', title: 'Task 2' });
      await repo.upsert(writeCtx, { ...task2, status: 'done' });

      const spec = and(Task.ByProject('proj-1'), Task.ByStatuses('todo'));
      const cursor = { limit: 10, sort: Task.defaultSort };
      const page = await repo.list(readCtx, spec, cursor);

      expect(page.items).toHaveLength(1);
      expect(page.items[0].status).toBe('todo');
    });
  });

  describe('pagination', () => {
    test('hasMoreが正しく設定される', async () => {
      for (let i = 0; i < 5; i++) {
        await repo.upsert(writeCtx, Task.create({ projectId: 'proj-1', title: `Task ${i}` }));
      }

      const cursor = { limit: 3, sort: Task.defaultSort };
      const page = await repo.list(readCtx, Task.ByProject('proj-1'), cursor);

      expect(page.items).toHaveLength(3);
      expect(page.hasMore).toBe(true);
      expect(page.nextCursor).toBeDefined();
    });
  });
});
```

**テスト対象:**
- CRUD操作
- Specification変換
- ページネーション
- トランザクション

### Usecase Layer

**方針**: Repositoryをモックしてロジックをテスト

```typescript
// usecases/task/create-task.test.ts
import { describe, test, expect, mock } from 'bun:test';
import { createTask } from './create-task';
import { Project } from '../../models/project';
import { fail } from '../../models/common';

describe('createTask', () => {
  const mockProjectRepo = {
    get: mock(() => null),
  };

  const mockTaskRepo = {
    upsert: mock(() => {}),
  };

  const ctx = {
    repos: {
      project: mockProjectRepo,
      task: mockTaskRepo,
    },
    now: new Date('2025-01-01T00:00:00Z'),
  };

  test('プロジェクトが存在しない場合はエラー', async () => {
    mockProjectRepo.get.mockReturnValue(null);

    const usecase = createTask({
      projectId: 'non-existent',
      title: 'Test Task',
    });
    const result = await usecase.run(ctx);

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('NOT_FOUND');
  });

  test('プロジェクトが存在する場合はタスク作成', async () => {
    mockProjectRepo.get.mockReturnValue({ id: 'proj-1', name: 'Project' });

    const usecase = createTask({
      projectId: 'proj-1',
      title: 'Test Task',
    });
    const result = await usecase.run(ctx);

    expect(result.ok).toBe(true);
    expect(result.value?.title).toBe('Test Task');
    expect(mockTaskRepo.upsert).toHaveBeenCalled();
  });
});
```

**テスト対象:**
- ステップ間のデータフロー
- エラーケース（`fail`の返却）
- ビジネスルールの適用

### Presentation Layer

**方針**: 基本的にテスト不要（薄いレイヤー）

Presentation層は以下の責務のみを持つため、テストの優先度は低い：
- Zodバリデーション
- 型変換
- Usecase呼び出し

必要に応じてIntegration Testで確認。

```typescript
// presentation/routers/task.test.ts
import { describe, test, expect } from 'bun:test';
import { createCaller } from '../trpc';

describe('taskRouter', () => {
  test('不正な入力でバリデーションエラー', async () => {
    const caller = createCaller(testContext);

    await expect(
      caller.task.create({ projectId: '', title: '' })
    ).rejects.toThrow();
  });
});
```

---

## テストユーティリティ

### テストDB

```typescript
// テストではembedded-postgresを使用
// 各テストスイートでトランザクションを開始し、テスト後にロールバックすることで
// テスト間の独立性を保証
// スキーマはpgschemaにより起動時に自動適用される
```

### テストコンテキスト

```typescript
// テストコンテキストはembedded-postgres接続を使用
import { PgDatabase } from '../../src/repositories/common';
import { TaskRepositoryPostgres } from '../../src/repositories/task/postgres';
import { ProjectRepositoryPostgres } from '../../src/repositories/project/postgres';

export function createTestContext(db: PgDatabase) {
  return {
    db,
    repos: {
      task: new TaskRepositoryPostgres(),
      project: new ProjectRepositoryPostgres(),
    },
    now: new Date('2025-01-01T00:00:00Z'),
  };
}
```

### ファクトリ関数

```typescript
// test/factories/task.ts
import { Task } from '../../src/models/task';
import { createId } from '@paralleldrive/cuid2';

export function createTestTask(overrides: Partial<Task> = {}): Task {
  return {
    id: createId(),
    projectId: 'proj-1',
    title: 'Test Task',
    description: null,
    status: 'todo',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
```

---

## テスト実行

### コマンド

```bash
# 全テスト実行
bun test

# 特定ファイル
bun test src/models/task.test.ts

# パターンマッチ
bun test --grep "createTask"

# カバレッジ
bun test --coverage

# ウォッチモード
bun test --watch
```

### ディレクトリ構造

```
server/
├── src/
│   ├── models/
│   │   ├── task.ts
│   │   └── task.test.ts          # 同一ディレクトリにテスト
│   ├── repositories/
│   │   ├── common/
│   │   │   ├── sql.ts
│   │   │   └── sql.test.ts       # 実装の隣にテスト
│   │   └── task/
│   │       └── postgres/
│   │           ├── index.ts
│   │           └── index.test.ts  # 実装の隣にテスト
│   └── usecases/
│       ├── runner.ts
│       ├── runner.test.ts
│       └── task/
│           ├── create-task.ts
│           └── create-task.test.ts
```

---

## カバレッジ目標

| レイヤー | 目標 | 理由 |
|---------|------|------|
| Model | 90%+ | ビジネスロジックの中核 |
| Repository | 80%+ | DB操作の正確性が重要 |
| Usecase | 80%+ | ステップフローの検証 |
| Presentation | 50%+ | 薄いレイヤー、基本はIntegration |

---

## CI統合

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test --coverage
```

---

## ベストプラクティス

### 1. テストは独立させる

各テストは他のテストに依存しない。`beforeEach`で状態をリセット。

### 2. テストデータはファクトリで生成

ハードコードされたIDやデータを避け、ファクトリ関数を使用。

### 3. モックは最小限に

可能な限り実際のDB（インメモリ）を使用し、モックは外部サービス（Git、コマンド実行）に限定。

### 4. 境界値をテスト

空配列、null、最大値など境界条件を明示的にテスト。

### 5. エラーケースを重視

正常系だけでなく、`fail`が返されるケースを網羅。
