# ADR-0004: Raw SQL採用（ORM不採用）

## ステータス

採用 (Accepted)

## 日付

2026-02-28

## コンテキスト

Auto KanbanはSQLite (bun:sqlite)をデータベースとして採用することを決定した（ADR-0001参照）。次に、データベースアクセスの方式を選定する必要がある。

### 要件

- 型安全なクエリ実行
- SQLインジェクション防止
- 複雑なクエリ（JOIN、サブクエリ）への対応
- bun:sqliteの性能を最大限活用
- 保守性・可読性

### 検討した選択肢

#### 選択肢1: ORM（Drizzle, Prisma等）

**利点:**
- 型安全なクエリビルダー
- マイグレーション管理
- リレーション定義

**欠点:**
- 抽象化レイヤーによるオーバーヘッド
- 複雑なクエリの表現が困難または冗長
- ORM固有の学習コスト
- bun:sqliteとの互換性の懸念

#### 選択肢2: クエリビルダー（Kysely等）

**利点:**
- 型安全なSQLビルダー
- SQLに近い記法
- 軽量

**欠点:**
- スキーマ定義の重複
- 追加の依存関係
- bun:sqliteとの統合に追加作業が必要

#### 選択肢3: Raw SQL + 独自SQL Builder

**利点:**
- bun:sqliteの性能を100%活用
- SQLの知識がそのまま活用可能
- 追加依存なし
- 完全な柔軟性

**欠点:**
- 型安全性は自前で担保
- SQLインジェクション対策を自前で実装

## 決定

**Raw SQL + 独自SQL Builderを採用する。**

Specification Patternと組み合わせ、型安全性と柔軟性を両立する。

## 根拠

1. **bun:sqliteの性能活用**: ネイティブバインディングの性能を抽象化レイヤーで損なわない。

2. **SQLの直接記述**: Tagged Template Literalで直感的にSQLを記述。

```typescript
const query = sql`
  SELECT * FROM tasks
  WHERE project_id = ${projectId}
    AND status IN (${sql.join(statuses, ', ')})
  ORDER BY created_at DESC
  LIMIT ${limit + 1}
`;
```

3. **イミュータブルなSQL Builder**: パラメータは自動的にプレースホルダに変換され、SQLインジェクションを防止。

```typescript
// SQL オブジェクト
class SQL {
  readonly query: string;    // "SELECT * FROM tasks WHERE id = ?"
  readonly params: unknown[]; // ["task-123"]
}

// 合成操作
const where1 = sql`status = ${status}`;
const where2 = sql`project_id = ${projectId}`;
const combined = sql`${where1} AND ${where2}`;
// → "status = ? AND project_id = ?"
// → ["active", "proj-123"]
```

4. **Specification Patternとの統合**: Model層で定義したSpecificationをRepository層でSQLに変換。

```typescript
// Model層
const Task = defineSpecs({
  ById: (id: string) => ({ id }),
  ByProject: (projectId: string) => ({ projectId }),
  ByStatuses: (...statuses: Task.Status[]) => ({ statuses }),
});

// 使用側
const spec = and(Task.ByProject(projectId), Task.ByStatuses('todo', 'inprogress'));

// Repository層
const where = compToSQL(spec, taskSpecToSQL);
const fragment = sql`SELECT * FROM tasks WHERE ${where}`;
```

5. **学習コスト削減**: SQLの知識がそのまま活用可能。ORMの学習不要。

6. **複雑なクエリ対応**: JOIN、サブクエリ、Window関数など、SQLの全機能を直接使用可能。

## 結果

### ポジティブ

- bun:sqliteの性能を100%活用
- SQLの全機能を直接利用可能
- 追加依存なし
- Specification Patternによる再利用可能なクエリ条件
- プレースホルダ強制によるSQLインジェクション防止

### ネガティブ

- スキーマ変更時のマイグレーション管理を自前で実装
- 型安全性はmapRow関数での変換に依存
- 複数DBエンジン対応は想定しない

### 実装パターン

#### SQL Builder

```typescript
// repositories/sql.ts
export function sql(strings: TemplateStringsArray, ...values: unknown[]): SQL {
  // 値がSQLオブジェクトなら展開、それ以外はプレースホルダ
}

// ヘルパー
sql.join(values: unknown[], separator: string): SQL
sql.raw(str: string): SQL  // エスケープなし（テーブル名等）
sql.empty: SQL             // 空のSQL
```

#### Repository標準メソッド

```typescript
interface Repository<T, Spec, SortKey> {
  get(spec: Comp<Spec>): T | null;
  list(spec: Comp<Spec>, cursor: Cursor<SortKey>): Page<T>;
  upsert(model: T): void;
  delete(spec: Comp<Spec>): void;
  count(spec: Comp<Spec>): number;
}
```

#### Specification → SQL変換

```typescript
// compToSQL: 共通の and/or/not 処理
function compToSQL<T>(spec: Comp<T>, convert: (s: T) => SQL): SQL {
  if ('type' in spec) {
    switch (spec.type) {
      case 'and': return sql.join(spec.children.map(c => compToSQL(c, convert)), ' AND ');
      case 'or': return sql`(${sql.join(spec.children.map(c => compToSQL(c, convert)), ' OR ')})`;
      case 'not': return sql`NOT (${compToSQL(spec.child, convert)})`;
    }
  }
  return convert(spec);
}

// 各Repositoryで個別Spec変換を定義
function taskSpecToSQL(spec: Task.Spec): SQL {
  switch (spec.type) {
    case 'ById': return sql`id = ${spec.id}`;
    case 'ByProject': return sql`project_id = ${spec.projectId}`;
    case 'ByStatuses': return sql`status IN (${sql.join(spec.statuses, ', ')})`;
  }
}
```

## 参考資料

- [bun:sqlite ドキュメント](https://bun.sh/docs/api/sqlite)
- [Specification Pattern](https://en.wikipedia.org/wiki/Specification_pattern)
- [Tagged Template Literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates)
