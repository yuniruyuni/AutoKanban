---
id: "01KPNX4PAGF5SEPD75ZYWRMEDH"
name: "variant_is_an_executor_launch_preset"
status: "draft"
---

## 関連ファイル

- `server/src/models/variant/index.ts`
- `server/schema/tables/variants.sql`
- `server/src/usecases/setup/seed-variants.ts`
- `client/src/components/chat/StartAgentDialog.tsx`

## 機能概要

**Variant は、Executor（`claude-code`, `gemini` 等）の起動プリセットを名前付きで保存するエンティティ**である。
`{ executor, name, permissionMode, model, appendPrompt }` を持ち、`(executor, name)` が
一意キー。StartAgentDialog でユーザーが「どの variant で起動する？」を選ぶ。

## 設計意図

### なぜ Variant を独立したエンティティにしたか

同じ Claude Code でも起動の仕方はいくつも考えられる:

- 通常モード（`default`）— 読み書き自由に実装させる
- plan モード（`plan`）— 計画だけ作らせて実装は止める
- モデル差 — Opus でゆっくり / Haiku で速く
- 固定の追加指示 — 「必ず日本語で回答」「TDD で書く」等の常套文

毎回ユーザーに `--permission-mode plan --model claude-opus-4-7 --append-prompt "日本語で"`
と打たせるのは煩雑で、かつ**同じ組み合わせを繰り返し使う**性質がある。
これらの組み合わせに**名前を付けて保存** → ダイアログで選ぶだけにしたのが Variant。

### executor ごとに独立

unique key は `(executor, name)`。これは**executor の違いを設定レベルで混ぜない**ための設計:

- Claude Code の `plan` モードと Gemini の `plan` モードは別物
- Gemini には `--permission-mode` が無い（設定項目の意味が違う）
- executor を跨いで variant を流用できないようにすることで、誤って未対応オプションを渡す事故を防ぐ

この設計は AutoKanban が「複数 Coding Agent を並行して扱う」方針の副作用でもある。
executor 固定なら Variant は単なる `Preset` で済んだ。

### `appendPrompt` の意図

毎タスクごとに「日本語で回答してください」を書くのは面倒。`appendPrompt` に入れておけば
全実行で自動的に末尾に結合される。グローバルな prompt prefix ではなく variant ごとに
設定できるのがポイントで、variant ごとに「日本語モード」「英語モード」「TDD モード」等を
切り替えられる。

### 初回 seed

`seed-variants.ts` が初回起動時に各 executor に `default` と `plan` の 2 variant を入れる。
これにより 0 からユーザーが variant を作らなくてもすぐ動き始められる。

## 主要メンバー

- `id / executor / name`
- `permissionMode: string | null` — Claude Code `--permission-mode`
- `model: string | null` — `--model`
- `appendPrompt: string | null` — prompt 末尾追加
- `createdAt / updatedAt`
- 一意制約: `(executor, name)`

## 関連する動作

- CRUD: [variants_are_managed_per_executor](./variants_are_managed_per_executor.md)
- 使用: [execution_is_started_for_task](../execution/execution_is_started_for_task.md) の variant 引き
