# ADR-0004: Raw SQL採用（ORM不採用）

## ステータス

採用 (Accepted)

## 日付

2026-02-28

## コンテキスト

Auto Kanbanのデータベースアクセス方式を選定する必要がある。

### 要件

- 型安全なクエリ実行
- SQLインジェクション防止
- 複雑なクエリ（JOIN、サブクエリ）への対応
- 保守性・可読性

### 検討した選択肢

#### 選択肢1: ORM（Drizzle, Prisma等）

**利点:** 型安全なクエリビルダー、マイグレーション管理、リレーション定義
**欠点:** 抽象化レイヤーによるオーバーヘッド、複雑なクエリの表現が困難、ORM固有の学習コスト

#### 選択肢2: クエリビルダー（Kysely等）

**利点:** 型安全なSQLビルダー、SQLに近い記法
**欠点:** スキーマ定義の重複、追加の依存関係

#### 選択肢3: Raw SQL + 独自SQL Builder

**利点:** SQLの知識がそのまま活用可能、完全な柔軟性、追加依存最小
**欠点:** 型安全性は自前で担保、SQLインジェクション対策を自前で実装

## 決定

**Raw SQL + 独自SQL Builderを採用する。**

Specification Patternと組み合わせ、型安全性と柔軟性を両立する。

## 根拠

1. **SQLの直接記述**: Tagged Template Literalで直感的にSQLを記述。

```typescript
const query = sql`
  SELECT * FROM tasks
  WHERE project_id = ${projectId}
    AND status IN (${sql.join(statuses, ', ')})
  ORDER BY created_at DESC
  LIMIT ${limit + 1}
`;
```

2. **イミュータブルなSQL Builder**: パラメータは自動的にプレースホルダに変換され、SQLインジェクションを防止。PostgreSQLの`$1, $2, ...`プレースホルダへは`PgDatabase`内の`finalize()`関数が`?`から自動変換。

```typescript
// SQL オブジェクト
interface SQLFragment {
  readonly query: string;    // "SELECT * FROM tasks WHERE id = ?"
  readonly params: unknown[]; // ["task-123"]
}

// finalize()で ?→$1,$2... に変換（Repository側は意識不要）
```

3. **Specification Patternとの統合**: Model層で定義したSpecificationをRepository層でSQLに変換。

```typescript
// Model層
const spec = Task.ByProject(projectId).and(Task.ByStatuses('todo', 'inprogress'));

// Repository層
const where = compToSQL(spec, taskSpecToSQL);
const fragment = sql`SELECT * FROM tasks WHERE ${where}`;
```

4. **学習コスト削減**: SQLの知識がそのまま活用可能。ORMの学習不要。

5. **複雑なクエリ対応**: JOIN、サブクエリ、Window関数など、SQLの全機能を直接使用可能。

## 結果

### ポジティブ

- SQLの全機能を直接利用可能
- Specification Patternによる再利用可能なクエリ条件
- プレースホルダ強制によるSQLインジェクション防止
- DBエンジン変更時もSQL BuilderとSpec変換は再利用可能（SQLite→PostgreSQL移行で実証済み）

### ネガティブ

- 型安全性はrowToEntity関数での変換に依存
- スキーマ変更時のマイグレーション管理は別ツール（pgschema）に委譲

## 実装パターン

### SQL Builder

```typescript
// repositories/sql.ts
export function sql(strings: TemplateStringsArray, ...values: unknown[]): SQLFragment

// ヘルパー
sql.join(values: unknown[], separator: string): SQLFragment
sql.raw(str: string): SQLFragment  // エスケープなし（テーブル名等）
sql.empty: SQLFragment              // 空のSQL（1=1）
```

### PgDatabase（クエリ実行）

```typescript
class PgDatabase {
  queryGet<T>(fragment: SQLFragment): Promise<T | null>   // 1行取得
  queryAll<T>(fragment: SQLFragment): Promise<T[]>         // 複数行取得
  queryRun(fragment: SQLFragment): Promise<{ rowCount: number }> // 更新系
}
```

### Repository標準メソッド

```typescript
interface ITaskRepository {
  get(spec: Task.Spec): Promise<Task | null>;
  list(spec: Task.Spec, cursor: Cursor<Task.SortKey>): Promise<Page<Task>>;
  upsert(task: Task): Promise<void>;
  delete(spec: Task.Spec): Promise<number>;
  count(spec: Task.Spec): Promise<number>;
}
```

## 参考資料

- [pg (node-postgres)](https://node-postgres.com/)
- [Specification Pattern](https://en.wikipedia.org/wiki/Specification_pattern)
- [Tagged Template Literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates)
- [ADR-0011: PostgreSQL移行](./0011-postgresql-migration.md)
