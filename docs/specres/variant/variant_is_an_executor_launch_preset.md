---
id: "01KPNX4PAGF5SEPD75ZYWRMEDH"
name: "variant_is_an_executor_launch_preset"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/models/variant/index.ts`
- `server/src/models/agent/`
- `server/schema/tables/variants.sql`
- `server/src/usecases/setup/seed-variants.ts`
- `client/src/components/chat/StartAgentDialog.tsx`

## 機能概要

**Variant は、Agent（`claude-code`, `gemini-cli`, `codex-cli` 等）の起動プリセットを名前付きで保存するエンティティ**である。
`{ executor, name, permissionMode, model, appendPrompt }` を持ち、`(executor, name)` が
一意キー。StartAgentDialog でユーザーが「どの variant で起動する？」を選ぶ。

ここで `executor` は歴史的なカラム名だが、現在の設計上は
[Agent](../agent/agent_is_the_coding_agent_definition.md) の `id` を指す。
つまり `Variant.executor = "codex-cli"` は「Codex CLI agent 用の起動プリセット」という意味になる。

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

### Agent ごとに独立

unique key は `(executor, name)`。これは**Agent の違いを設定レベルで混ぜない**ための設計:

- Claude Code の `plan` モードと Gemini の `plan` モードは別物
- Gemini には `--permission-mode` が無い（設定項目の意味が違う）
- Codex CLI の `full-auto` / `read-only` / `dangerously-bypass` は Claude Code の
  `default` / `plan` / `bypassPermissions` と意味が異なる
- Agent を跨いで variant を流用できないようにすることで、誤って未対応オプションを渡す事故を防ぐ

この設計は AutoKanban が「複数 Coding Agent を並行して扱う」方針の副作用でもある。
Agent 固定なら Variant は単なる `Preset` で済んだ。

### `appendPrompt` の意図

毎タスクごとに「日本語で回答してください」を書くのは面倒。`appendPrompt` に入れておけば
全実行で自動的に末尾に結合される。グローバルな prompt prefix ではなく variant ごとに
設定できるのがポイントで、variant ごとに「日本語モード」「英語モード」「TDD モード」等を
切り替えられる。

### 初回 seed

`seed-variants.ts` は初回起動時に `AgentRepository.list()` から Agent catalog を読み、
各 Agent の `defaultVariants` を seed する。初期値は Agent model 側に置くことで、
Codex CLI のような新しい Agent を追加したときに Variant seed と Agent 定義がずれないようにする。

現時点の初期 variant:

| Agent | Variant | permissionMode |
|---|---|---|
| Claude Code | `DEFAULT` | `default` |
| Claude Code | `BYPASS` | `bypassPermissions` |
| Claude Code | `PLAN` | `plan` |
| Gemini CLI | `DEFAULT` | `bypassPermissions` |
| Codex CLI | `DEFAULT` | `full-auto` |
| Codex CLI | `READONLY` | `read-only` |
| Codex CLI | `YOLO` | `dangerously-bypass` |

## 主要メンバー

- `id / executor / name`
- `permissionMode: string | null` — Agent ごとの権限 / sandbox 起動モード。
  Claude Code では `--permission-mode`、Codex CLI では `--full-auto` / `--sandbox read-only` /
  `--dangerously-bypass-approvals-and-sandbox` などに repository/infra 側で変換される
- `model: string | null` — `--model`
- `appendPrompt: string | null` — prompt 末尾追加
- `createdAt / updatedAt`
- 一意制約: `(executor, name)`

## 関連する動作

- CRUD: [variants_are_managed_per_executor](./variants_are_managed_per_executor.md)
- 使用: [execution_is_started_for_task](../execution/execution_is_started_for_task.md) の variant 引き
- Agent 定義: [agent_is_the_coding_agent_definition](../agent/agent_is_the_coding_agent_definition.md)
