---
id: "01KPQ6W85ST432T45FW553KDDE"
name: "tests_are_layered_per_responsibility"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/**/*.test.ts` (実装の隣にテストファイルを配置)
- `client/src/**/*.test.tsx`
- `e2e/tests/*.spec.ts`
- `.claude/rules/testing.md`
- `package.json` (ルート `check:test` / `check:e2e` スクリプト)

## 機能概要

テストは **レイヤーごとに戦略を変える**。各レイヤーの責務にもっとも近い検証手段を選び、
「実装の隣に `*.test.ts` を置く」規約で近接性を保つ。

| レイヤー | 戦略 | カバレッジ目安 | 備考 |
|---|---|---|---|
| Model | 純粋関数を bun:test で Unit Test | 90%+ | ビジネスルールの中核 |
| Repository | **embedded-postgres を使った Integration Test** | 80%+ | モックしない |
| Usecase | Repository をモックして step フローを検証 | 80%+ | Fail ケースを網羅 |
| Presentation | 薄いレイヤーなので基本は書かない | 低め | Zod 検証の境界条件のみ |
| UI (Client) | `@testing-library/react` + `vitest` | — | コンポーネント単位 |
| E2E | Playwright | 少数 | ゴールデンパスと承認フロー |

ランナーは **bun:test**（server / e2e）と **vitest**（client）。
起動コマンドは `bun run check:test`（全 workspace 並列）と `bun run check:e2e`。

## 設計意図

- **レイヤーの責務に合わせて道具を選ぶ**: Model は純粋関数なので mock 不要。Repository は
  SQL の組み立てとマッピングが関心事なので **本物の PostgreSQL に当てる**ほうが速くて正確。
  Usecase はステップ間の制御フローが関心事なので Repository を mock して分岐を網羅する
- **テストを実装の隣に置く**: `server/src/usecases/task/create-task.ts` の隣に
  `create-task.test.ts`。ファイル移動時にテストも追従させる、ドキュメントとして読める、
  test-only の import 距離が短い、の 3 点が主な理由
- **モックは最小限**: Repository まで mock すると SQL バグを見逃す。embedded-postgres は
  初回起動こそ数秒かかるが、以降は同一プロセス内で高速に動く
- **Presentation 層を薄く保つ**: handleResult と Zod input バリデーションだけが主な責務
  なので、ここに厚いテストを積まない。Usecase 層の Fail 分岐で網羅する
- **テストの独立性**: embedded-postgres を使う Integration Test は、起動時の pgschema による
  スキーマ適用だけを共通セットアップとし、テストごとに DELETE / TRUNCATE ではなく
  **各 Usecase が作る ID がぶつからないような自然な独立性**に任せる

## 検討された代替案

- **テストピラミッドを厳密に守り Unit を最大化**: Repository もモックで済ませる道だが、
  SQL 変換のバグが出るたびに production まで漏れるリスクがある。
  embedded-postgres の導入コストを払って Integration を増やす方が合理的
- **すべての層に 100% を要求する**: Presentation のような薄い層まで網羅すると
  テスト保守コストが急増する。責務に応じたカバレッジ目標のほうが現実的
- **`__tests__` ディレクトリに分離**: ファイル移動のたびにテストの追従を忘れる危険があり、
  ファイル探索も 2 倍になる。実装の隣に置くのが最短距離

## 主要メンバー

- **bun:test**: server / e2e の標準ランナー
- **vitest**: client 側（React 互換のため）
- **embedded-postgres**: Repository Integration Test 用の PG
- **ファクトリ関数**: Task / Project など各 Model には `create()` がある。テストでも
  ハードコードせず `Task.create({...})` でインスタンス生成する
- **`generateId()`**: ID は全て Model Factory 経由で生成。`@paralleldrive/cuid2` や
  `crypto.randomUUID()` を直接呼ばない（`.claude/rules/server-patterns.md`）

## 関連する動作

- [usecase_is_executed_in_6_steps](./usecase_is_executed_in_6_steps.md) — Usecase Test で fail の分岐を検証する対象
- [fail_type_replaces_exceptions](./fail_type_replaces_exceptions.md) — Fail を返すケースのテストパターン
- [postgresql_is_embedded_for_storage](./postgresql_is_embedded_for_storage.md) — Repository Integration Test の足場
- [raw_sql_is_used_instead_of_orm](./raw_sql_is_used_instead_of_orm.md) — Repository レイヤーでテストする理由
