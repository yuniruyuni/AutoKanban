# ADR-0008: Specification Pattern採用

## ステータス

採用 (Accepted)

## 日付

2026-02-28

## コンテキスト

Raw SQL採用（ADR-0004）により、データベースクエリは直接SQLで記述する。しかし、クエリ条件の再利用性と合成可能性を確保する必要がある。

### 要件

- クエリ条件の再利用
- 条件の合成（AND/OR/NOT）
- 型安全性
- Model層での条件定義
- Repository層でのSQL変換

### 検討した選択肢

#### 選択肢1: 条件をそのままSQL文字列で渡す

```typescript
taskRepo.list(`project_id = '${projectId}' AND status = 'todo'`);
```

**欠点:**
- SQLインジェクションリスク
- 型安全性なし
- 再利用困難

#### 選択肢2: フィルターオブジェクト

```typescript
taskRepo.list({ projectId, status: 'todo' });
```

**欠点:**
- 複雑な条件（OR、NOT）の表現が困難
- 条件の合成ロジックがRepository内に散らかる

#### 選択肢3: Specification Pattern

```typescript
const spec = and(Task.ByProject(projectId), Task.ByStatus('todo'));
taskRepo.list(spec);
```

**利点:**
- 条件の再利用
- AND/OR/NOTで合成可能
- Model層で定義、Repository層でSQL変換

## 決定

**Specification Patternを採用する。**

Model層でSpecificationを定義し、`Comp<T>`型で合成可能にする。

## 根拠

1. **条件の再利用**: 一度定義したSpecificationは複数のクエリで再利用可能。

```typescript
// 定義
const Task = defineSpecs({
  ById: (id: string) => ({ id }),
  ByProject: (projectId: string) => ({ projectId }),
  ByStatuses: (...statuses: Task.Status[]) => ({ statuses }),
});

// 再利用
taskRepo.get(Task.ById(taskId));
taskRepo.list(Task.ByProject(projectId));
taskRepo.count(and(Task.ByProject(projectId), Task.ByStatuses('todo')));
```

2. **合成可能性**: `and`/`or`/`not`ヘルパーで直感的に合成。

```typescript
// AND
const activeTasks = and(
  Task.ByProject(projectId),
  Task.ByStatuses('todo', 'inprogress')
);

// OR
const importantTasks = or(
  Task.ByProject('project-1'),
  Task.ByProject('project-2')
);

// NOT
const nonCancelledTasks = not(Task.ByStatuses('cancelled'));

// 複合
const spec = and(activeTasks, nonCancelledTasks);
```

3. **型安全性**: `defineSpecs`と`SpecsOf`で型を自動導出。

```typescript
// defineSpecsで定義
export const Task = defineSpecs({
  ById: (id: string) => ({ id }),
  ByProject: (projectId: string) => ({ projectId }),
});

// SpecsOfで型を自動導出
export namespace Task {
  export type Spec = SpecsOf<typeof Task>;
  // = { type: 'ById'; id: string } | { type: 'ByProject'; projectId: string }
}
```

4. **関心の分離**: Model層で「何を」、Repository層で「どうやって」を定義。

```typescript
// Model層: 条件の意味を定義
const Task = defineSpecs({
  ByProject: (projectId: string) => ({ projectId }),
});

// Repository層: SQLへの変換を定義
function taskSpecToSQL(spec: Task.Spec): SQL {
  switch (spec.type) {
    case 'ByProject': return sql`project_id = ${spec.projectId}`;
  }
}
```

5. **compToSQLで共通処理**: AND/OR/NOTの処理はcompToSQLで共通化。

```typescript
function compToSQL<T>(spec: Comp<T>, convert: (s: T) => SQL): SQL {
  if ('type' in spec && spec.type === 'and') {
    return sql.join(spec.children.map(c => compToSQL(c, convert)), ' AND ');
  }
  // ... or, not 処理
  return convert(spec);
}
```

## 結果

### ポジティブ

- クエリ条件の再利用性向上
- 直感的な条件合成
- 型安全な条件定義
- Model層とRepository層の責務分離
- DRY原則の遵守（compToSQLで共通化）

### ネガティブ

- 単純なクエリでもSpecification経由となる
- 新しいSpecification追加時はModel層とRepository層の両方を修正

### 実装詳細

#### Comp型

```typescript
// models/common.ts
export type Comp<T> =
  | T
  | { type: 'and'; children: Comp<T>[] }
  | { type: 'or'; children: Comp<T>[] }
  | { type: 'not'; child: Comp<T> };

export const and = <T>(...children: Comp<T>[]): Comp<T> =>
  ({ type: 'and', children });

export const or = <T>(...children: Comp<T>[]): Comp<T> =>
  ({ type: 'or', children });

export const not = <T>(child: Comp<T>): Comp<T> =>
  ({ type: 'not', child });
```

#### defineSpecsヘルパー

```typescript
// models/common.ts
export function defineSpecs<T extends Record<string, (...args: never[]) => object>>(specs: T): {
  [K in keyof T & string]: (...args: Parameters<T[K]>) => ReturnType<T[K]> & { type: K }
} {
  const result = {} as any;
  for (const key of Object.keys(specs)) {
    result[key] = (...args: unknown[]) => ({
      type: key,
      ...specs[key](...args),
    });
  }
  return result;
}

export type SpecsOf<T> = {
  [K in keyof T]: T[K] extends (...args: never[]) => infer R
    ? R extends { type: string } ? R : never
    : never
}[keyof T];
```

#### Model層での定義例

```typescript
// models/task.ts
import { defineSpecs, type SpecsOf } from './common';

export const Task = defineSpecs({
  ById: (id: string) => ({ id }),
  ByProject: (projectId: string) => ({ projectId }),
  ByStatus: (status: Task.Status) => ({ status }),
  ByStatuses: (...statuses: Task.Status[]) => ({ statuses }),
});

export namespace Task {
  export type Status = 'todo' | 'inprogress' | 'inreview' | 'done' | 'cancelled';
  export type Spec = SpecsOf<typeof Task>;
}
```

#### Repository層での変換

```typescript
// repositories/task-repository.ts
import { compToSQL } from './common';

function taskSpecToSQL(spec: Task.Spec): SQL {
  switch (spec.type) {
    case 'ById':
      return sql`id = ${spec.id}`;
    case 'ByProject':
      return sql`project_id = ${spec.projectId}`;
    case 'ByStatus':
      return sql`status = ${spec.status}`;
    case 'ByStatuses':
      return sql`status IN (${sql.join(spec.statuses, ', ')})`;
  }
}

class TaskRepository {
  list(spec: Comp<Task.Spec>, cursor: Cursor<Task.SortKey>): Page<Task> {
    const where = compToSQL(spec, taskSpecToSQL);
    const fragment = sql`SELECT * FROM tasks WHERE ${where}`;
    // ...
  }
}
```

## 参考資料

- [Specification Pattern (Wikipedia)](https://en.wikipedia.org/wiki/Specification_pattern)
- [ADR-0004: Raw SQL採用](./0004-raw-sql-adoption.md)
