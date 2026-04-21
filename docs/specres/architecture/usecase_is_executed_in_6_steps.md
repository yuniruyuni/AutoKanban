---
id: "01KPPZWHXW033P9RPM4RVH9Q21"
name: "usecase_is_executed_in_6_steps"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/usecases/runner.ts` (`usecase()` ランナー本体)
- `server/src/usecases/context.ts` (`PreContext` / `ReadContext` / `ProcessContext` / `WriteContext` / `PostContext`)
- `server/src/models/common.ts` (`Fail` / `fail()` / `isFail()`)
- `server/src/presentation/handle-result.ts` (`Result<T, Fail>` → `TRPCError`)
- `.claude/rules/server-patterns.md`

## 機能概要

すべての Usecase は `pre → read → process → write → post → result` の **6 ステップ**で構成される。

```ts
export const createTask = (input: CreateTaskInput) =>
  usecase({
    pre:     async ()              => { /* バリデーション、fail() で早期リターン */ },
    read:    async (ctx)           => { /* DB 読取 */ },
    process: (_ctx, state)         => { /* 純粋計算 */ },
    write:   async (ctx, state)    => { /* DB 書込 */ },
    post:    async (ctx, state)    => { /* External I/O (Git, Executor 等) */ },
    result:  (state)               => { /* 最終整形 */ },
  });
```

**全ステップ省略可能**。省略時は identity 関数が適用される。

### トランザクション境界

`read → process → write` は単一トランザクション内で実行される:

- write ステップがあれば `BEGIN`
- read のみなら `BEGIN READ ONLY`
- read も write もなければトランザクションなし

**External 呼び出し（Git / Executor / Script Runner）は post ステップでのみ行う**。
これがトランザクションを引き延ばさない最重要ルール。

### エラーハンドリング

任意のステップで `fail("CODE", "message", details?)` を return すると後続ステップは
スキップされ、`Result<T, Fail>` として Presentation 層に届く。例外ではなく戻り値で表現する。

## 設計意図

- **`let` と `!` を構造的に排除**: 各ステップは「前ステップの state を受け取り、次の state を返す」
  という単方向の純粋なデータフロー。型推論で Fail が自動除外され、
  non-null assertion (`!`) が要らない
- **1 Usecase = 1 Transaction**: トランザクション境界を明示することで整合性保証が型レベルで
  見える。ネストした Usecase 呼び出しを禁止するのもこの境界を守るため
- **Step context が絞られている**: `process` は `repos` を受け取らない（純粋計算のみ）、
  `write` は External I/O できない、など、各ステップで触れる能力が型で制限されている。
  「純粋ロジックをうっかり I/O に引きずる」ような混ざり方を構造的に防ぐ
- **Presentation 層で `handleResult()` が Result を TRPCError に変換**: Usecase 層は
  例外を一切投げない。try/catch がビジネスコード中に散らない

## 検討された代替案

- **クラスベース Usecase (`class CreateTaskUsecase { execute() }` )**: 例外ベースで書くと
  制御フローが追いにくく、`let project; if (!project) throw ...` のような書き方が蔓延する
- **関数ベース + Result 型のみ**: ステップ分割なしで `Result` を返す書き方は軽いが、
  トランザクション境界・前後処理（ロギング、tracing）の統一ポイントが無い
- **Railway Oriented Programming 的な流れるインターフェース**: 似た発想だが、6 ステップの
  context 制限のほうが AutoKanban の「外部 I/O を post に押し込む」規約と相性が良い

## 主要メンバー

| ステップ | Context | 用途 |
|---|---|---|
| `pre` | `PreContext` (`now`, `logger`) | バリデーション、早期 fail |
| `read` | `ReadContext` (+ `DbReadRepos`) | DB 読取のみ。External 不可 |
| `process` | `ProcessContext` (`now`, `logger`) | 純粋計算。repos へのアクセス不可 |
| `write` | `WriteContext` (+ `DbWriteRepos`) | DB 書込 + 再読取 |
| `post` | `PostContext` (+ `FullRepos`) | Git / Executor / MCP 等の External I/O |
| `result` | なし | 最終整形（純粋関数） |

呼び出し方: `createTask(input).run(ctx)` → `Promise<Result<T, Fail>>`

## 関連する動作

- [layered_architecture_separates_model_repository_usecase_presentation](./layered_architecture_separates_model_repository_usecase_presentation.md) — Usecase 層の位置づけ
- [specification_pattern_composes_db_filters](./specification_pattern_composes_db_filters.md) — read/write で Model の Spec を使う
- [trpc_is_the_client_server_protocol](./trpc_is_the_client_server_protocol.md) — `handleResult()` が tRPC 側
- 各振る舞いカード全般（`execution_is_started_for_task` / `task_is_created_in_todo` etc.）がこの 6 ステップに従う
