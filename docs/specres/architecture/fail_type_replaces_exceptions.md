---
id: "01KPQ6W85WC3WMHX9ZKHAACSJ6"
name: "fail_type_replaces_exceptions"
status: "draft"
---

## 関連ファイル

- `server/src/models/common/fail.ts` (`Fail` 型 / `fail()` / `isFail()` / `Unfail<T>`)
- `server/src/usecases/runner.ts` (`Result<T, Fail>` を返す usecase ランナー)
- `server/src/presentation/handle-result.ts` (`Result` → `TRPCError` 変換)
- `client/src/hooks/use-*` 系 (React Query の `onError` パターン)

## 機能概要

AutoKanban は **戻り値ベースのエラーハンドリング**を全面採用している。
ビジネスロジック上のエラーは `throw` せず、**`fail(code, message, details?)` を return** する。

```ts
// Usecase 内
if (!task) return fail("NOT_FOUND", "Task not found", { taskId });
```

`fail()` は `Fail` 型のブランド付きオブジェクトを作る。Usecase ランナーは各ステップの戻り値を
`isFail()` で判定し、Fail なら後続ステップをスキップして `Result<T, Fail>` を返す。
Presentation 層の `handleResult()` が `Result` を最終的に `TRPCError` へ変換して tRPC クライアントに届ける。

例外 (`throw`) は以下の場合のみ使う:

- DB ドライバや外部ライブラリが投げる例外（ランナー側の try/catch で `INTERNAL` に正規化）
- 本当に回復不能な実装バグ（到達不能なコードなど）

ビジネスロジック由来の「期待された失敗」は全て Fail で表現する。

## 設計意図

### なぜ例外ではなく戻り値か

- **型でエラーを追跡できる**: `Task | Fail` という戻り値型が呼び出し側にエラー分岐を強制する。
  `throw` は型に現れないので、ハンドラを忘れても型検査が通ってしまう
- **制御フローが追いやすい**: 例外 + try/catch は非局所的ジャンプで、ステップ境界をまたぐ
  リカバリロジックが絡まる。Fail は「ステップの戻り値を見て次を決める」という通常のフロー
- **Usecase ランナーとの統合**: `pre → read → process → write → post → result` の 6 ステップの
  途中で Fail が返れば以降をスキップ、という仕様が極めて単純に実装できる
- **`let` と `!` の排除**: Fail を除去した型が次ステップの入力になるので、`task!.projectId`
  のような non-null assertion が要らない（型推論で Fail が自動除外される）

### 標準エラーコード

コード名は**プロジェクト共通の語彙**として保つ。新規追加は Fail を返すすべての場所で意味が
ぶれないよう慎重に。現状のコード一覧:

| コード | 意味 | 代表的な使用場面 |
|---|---|---|
| `NOT_FOUND` | 対象リソースなし | `ctx.repos.task.get(...)` が null |
| `INVALID_INPUT` | 入力値不正 / 前提条件違反 | 空のタイトル、存在しない targetBranch |
| `INVALID_STATE` | 現在状態と操作が矛盾 | `killed` プロセスを停止しようとした |
| `INVALID_TRANSITION` | ステータス遷移が不許可 | 現状では使用箇所なし（全遷移許可） |
| `DUPLICATE` | 一意制約違反 | `repoPath` が他プロジェクトと衝突 |
| `CONFLICT` | 競合（rebase など） | Rebase 中にコンフリクト |
| `WORKTREE_ERROR` | Git worktree 操作失敗 | `ensureWorktreeExists` 失敗 |
| `PREPARE_SCRIPT_FAILED` | `auto-kanban.json` の prepare 失敗 | agent 起動前の prepare exit != 0 |
| `GIT_ERROR` | 汎用 Git 操作失敗 | rebase / merge / push 失敗 |
| `GH_CLI_ERROR` | `gh` コマンド失敗 | PR 作成時の認証エラーなど |
| `EXECUTION_ERROR` | Tool 実行失敗 | カスタム Tool の exec 失敗 |
| `INVALID_COMMAND` | コマンド置換後の空文字 | Tool の `{path}` 置換後が空 |
| `NOT_FAST_FORWARDABLE` | fast-forward merge 不可 | base branch が先行 |
| `INTERNAL` | ランナーの try/catch 正規化 | 予期しない例外 |

### Presentation 層での TRPCError マッピング

`handleResult(result)` が `Result<T, Fail>` を受け取り:

- `ok: true` → `result.value` をそのまま返す
- `ok: false` → `TRPCError` を throw
  （コード対応: `NOT_FOUND → NOT_FOUND` / `INVALID_*` / `DUPLICATE → CONFLICT` / その他 → `INTERNAL_SERVER_ERROR`）

この変換を **Presentation 層に閉じ込める**ことで、Usecase 層は tRPC を一切知らないまま
エラーを返せる（Usecase は HTTP 用フレームワークと疎結合）。

### クライアント側のエラー処理

tRPC client は `TRPCError` を `error.data.code` + `error.message` として受け取る。
React Query の `onError` で toast 表示・ローカルロールバックを行うのが慣習:

```ts
trpc.task.update.useMutation({
  onError: (error) => {
    if (error.data?.code === "NOT_FOUND") toast.error("タスクが見つかりません");
    else toast.error(error.message);
  },
});
```

## 検討された代替案

- **例外ベース**: 書き始めは速いが、型でエラーを追跡できないため handler 漏れが潜伏する。
  Railway Oriented Programming 的な合成も書きにくい
- **`Result<T, E>` を全レイヤーで手動合成**: Fail + Usecase ランナーの組み合わせで実質同じ
  ことを達成しつつ、ステップ境界でのショートサーキットをランナーに吸収させるほうが軽い
- **`neverthrow` など外部ライブラリ**: 依存を増やすほどの価値がない。`fail()` / `isFail()` /
  `Unfail<T>` の 3 つで十分機能する

## 主要メンバー

- `Fail` — `{ [FAIL_BRAND]: true, code, message, details? }` のブランド型
- `fail(code, message, details?)` — Fail ファクトリ
- `isFail(value)` — 型ガード
- `Unfail<T>` — `T extends Fail ? never : T` の型ユーティリティ
- `Result<T, Fail>` — `{ ok: true, value: T } | { ok: false, error: Fail }`
- `handleResult(result)` — Presentation 層で tRPC エラーに変換

## 関連する動作

- [usecase_is_executed_in_6_steps](./usecase_is_executed_in_6_steps.md) — ステップ間の Fail 短絡
- [trpc_is_the_client_server_protocol](./trpc_is_the_client_server_protocol.md) — Presentation 層の TRPCError マッピング
- [tests_are_layered_per_responsibility](./tests_are_layered_per_responsibility.md) — Fail 分岐のテストパターン
