---
id: "01KPNTBSG1VTZH0VGAVST7EX29"
name: "variants_are_managed_per_executor"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/usecases/variant/create-variant.ts`, `list-variants.ts`, `update-variant.ts`, `delete-variant.ts`
- `server/src/usecases/variant/variant.test.ts` (Test)
- `server/src/usecases/setup/seed-variants.ts` (初回 seed)
- `server/src/presentation/trpc/routers/variant.ts`
- `server/src/models/variant/index.ts`

## 機能概要

Executor（`claude-code`, `gemini` 等）ごとの起動プリセット「Variant」の CRUD。
Variant は `{ executor, name, permissionMode, model, appendPrompt }` を持ち、
StartAgentDialog でユーザーが `default` / `plan` などから選択する。

## 概念的背景: なぜ Variant を独立モデルにしたか

Claude Code を実行する方法は 1 つではない:

- 通常モード（読み書きを自由にやる）
- plan モード（計画だけ立てる、実装はしない）
- より強力なモデル（Opus）でゆっくり考える、小さいモデル（Haiku）でサクサク書く
- プロンプトに「TDD で書いて」「全部日本語で」などの定型指示を毎回つけたい

これらは毎回ユーザーが `--permission-mode plan --model claude-opus-4-7` のように入力するには
煩雑で、かつ**同じパターンの組み合わせ**が日常的に使い回される。
そこでこれらの組み合わせに**名前を付けて DB に保存**し、ダイアログでは名前を選ぶだけにしたのが
Variant という概念。

重要なのは Variant が **executor 毎に独立** していること: Claude Code の plan モードと
Gemini の plan モードは別物（Gemini にはそもそも `--permission-mode` がない）。
unique key を `(executor, name)` にすることで、executor の違いが設定レベルで混ざらないようにしている。

これは「AutoKanban が複数の Coding Agent を並行して扱う」という方針の副作用で、
1 executor 固定なら Variant は `Variant` ではなくただの `ExecutorPreset` で済む。

## 設計意図

- `permissionMode` は Claude Code の `--permission-mode` にそのまま渡る（例: `default`, `plan`）
- `model` は `--model` にそのまま渡る（例: `claude-sonnet-4-6`）
- `appendPrompt` は prompt の末尾に結合される（「日本語で回答」等の定型指示）
- unique key は `(executor, name)`
- 初回起動時に `seed-variants` が executor ごとに `default` と `plan` の 2 variant を seed して、
  ユーザーが 0 から作らなくてもすぐ使い始められるようにしている

## シナリオ

### CRUD via settings page

1. `/settings/agent/<executor>` からアクセス
2. `trpc.variant.list({ executor })` / `create` / `update` / `delete`

### Seed defaults

1. 初回起動時に `seed-variants` が executor ごとに `default` と `plan` の 2 variant を入れる

### Use at start-execution

1. `startExecution({ variant: "plan" })` で `Variant.ByExecutorAndName(executor, "plan")` を引く
2. 取得した variant を `executor.startProtocol({ permissionMode, model })` に渡す

## 失敗 / 例外

- `(executor, name)` 重複 → DB unique 制約違反（Repository 層で標準化）
