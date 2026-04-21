---
id: "01KPNX4PAJ6BSRVSN6GCP1ZSXG"
name: "agent_setting_is_the_executor_command_configuration"
status: "draft"
---

## 関連ファイル

- `server/src/models/agent-setting/index.ts`
- `server/schema/tables/agent_settings.sql`
- `server/src/repositories/agent-setting/`
- `client/src/pages/settings/AgentDetailPage.tsx`

## 機能概要

**AgentSetting は、Executor ごとの「実行バイナリのパス」設定を保持するエンティティ**である。
`{ id (= agentId, "claude-code" / "gemini"), command }` のシンプルな 2 フィールド。
Executor 起動時に `agentSettingEntity?.command` が `executor.startProtocol` の `command` 引数に
渡される。空なら PATH 上のデフォルト（`claude` / `gemini` 等）が使われる。

## 設計意図

### なぜ必要か

ユーザーの環境は多様:

- `claude` が PATH に入っていない
- 複数バージョンの `claude` を切り替えて使いたい（stable / beta）
- Nix / homebrew / 独自コンパイル済みバイナリなど、パスが固定でない

これを設定画面で明示できるようにしたのが AgentSetting。空にしておけば PATH 参照で済むので、
標準インストールのユーザーには何も要求しない。

### なぜ Variant と分離したか

Variant（起動プリセット）と AgentSetting（バイナリパス）は**関心が違う**:

- Variant は「**どう**実行するか」（mode, model, prompt）
- AgentSetting は「**どこの**実行バイナリを使うか」（command path）

同じテーブルに混ぜると、AgentSetting は 1 行 / 1 executor なのに Variant は N 行 / 1 executor、
という cardinality の違いで破綻する。分離することで両者のライフサイクルが独立する。

### 疎通確認（version check）

設定画面に「このパスで動く？」のボタンを付ける設計。`command --version` 相当を実行して
exit code と stdout を表示し、バージョン不整合や path typo をユーザーが即発見できる。
これは「AI が起動しない」問題のデバッグコストを大きく下げる。

## 主要メンバー

- `id: string` — `agentId` と等しい（例: `"claude-code"`, `"gemini"`）
- `command: string` — 実行バイナリパス（空なら PATH 参照）

## 関連する動作

- 設定: [agent_command_is_configured_and_checked](./agent_command_is_configured_and_checked.md)
- 使用: [execution_is_started_for_task](../execution/execution_is_started_for_task.md) /
  [follow_up_message_is_sent_or_queued](../execution/follow_up_message_is_sent_or_queued.md) の read ステップ
