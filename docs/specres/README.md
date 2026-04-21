# AutoKanban Specifications

このディレクトリは [specre](https://github.com/yoshiakist/specre) 形式の仕様カード群です。
各カードは「1 ファイル = 1 動作 / 概念」で書かれ、実装側の `// @specre <ULID>` コメントと双方向にリンクします。

---

## 1. AutoKanban とは

AutoKanban は **ローカル専用の AI エージェント付きカンバン・タスク管理アプリ**です。

- 個人開発者が、Claude Code や Gemini などの AI コーディングエージェントを複数並行で走らせながら、
  その進捗を**カンバンボード**の上で可視化し続けるためのツール
- ひとつのタスクが ひとつの **Git worktree**（ブランチ付き作業ディレクトリ）を持ち、
  エージェントが worktree 内でコードを書き、ログとコミット差分がそのままタスク詳細に流れ込む
- すべて**ローカル動作**（embedded-postgres、`dist/auto-kanban` 単一バイナリ配布）。
  ソースコードもクラウドに送信されない

主な利用シナリオ:

1. プロジェクト（Git リポジトリ）を登録する
2. 「やってほしいこと」をタスクとして書く
3. タスクを `todo → inprogress` に動かすと AI エージェントが worktree で走り出す
4. エージェントがツール使用の承認を求めたら `inreview` に自動遷移 → ApprovalCard で承認/否認
5. 完了したら PR を作成して `done` へ

---

## 2. Architecture at a Glance

### レイヤー (サーバー)

Model → Repository → Usecase → Presentation の 4 層。詳細は
[`architecture/layered_architecture_...`](./architecture/layered_architecture_separates_model_repository_usecase_presentation.md)
と [`.claude/rules/server-patterns.md`](../../.claude/rules/server-patterns.md) を参照。

Usecase は `pre → read → process → write → post → result` の 6 ステップで構成され、
`read → write` は単一トランザクション内で実行される。External I/O（Git / Executor / Script Runner）は
`post` 段階でのみ行う（トランザクション停滞を防ぐため）。

### ランタイム

- **Server**: Bun + Hono + tRPC + embedded-postgres（`pgschema` で起動時自動マイグレーション）
- **Client**: React 19 + Vite + Tailwind + Valtio + tRPC React Query
- **SSE stream**: `log-stream` / `structured-log-stream` / `draft-pr-stream` の 3 本
- **Callback**: Executor プロセスから Server に `on-log-data / on-process-complete / on-process-idle /
  on-session-info / on-summary / on-approval-request` の 6 種の HTTP コールバックが届く
- **MCP**: AutoKanban は自身を MCP サーバーとして外部 agent に登録可能
  （`server/src/presentation/mcp/stdio.ts`）

### 外部統合

| 用途 | 実装 |
|---|---|
| AI Executor (Claude Code / Gemini) | `server/src/repositories/executor/` |
| Git worktree 作成・削除 | `server/src/repositories/worktree/` |
| prepare / cleanup スクリプト実行 | `server/src/repositories/script-runner/` |
| MCP サーバー設定 | `server/src/repositories/agent-config/` |

---

## 3. Domain Map

| ドメイン | 概要 |
|---|---|
| [`architecture/`](./architecture/) | 設計ルール（TypeScript 統一 / tRPC / レイヤー / Raw SQL / Valtio / Usecase 6 ステップ / Specification Pattern / embedded-postgres / auto-kanban.json） |
| [`project/`](./project/) | プロジェクト（Git リポジトリ）の登録・更新・削除・Git 初期化 |
| [`task/`](./task/) | タスク CRUD とステータス遷移 (todo / inprogress / inreview / done / cancelled) |
| [`workspace/`](./workspace/) | タスク試行ごとの worktree・prepare/cleanup・attempts 管理 |
| [`execution/`](./execution/) | Coding Agent 実行の開始・停止・キュー・resume・fork |
| [`callback/`](./callback/) | Executor → Server の 6 種コールバック処理 |
| [`approval/`](./approval/) | DB 永続化される承認（ApprovalCard 応答） |
| [`permission/`](./permission/) | Claude Code の in-flight permission 応答 |
| [`log-stream/`](./log-stream/) | SSE ログ配信・構造化ログ・ANSI パース |
| [`dev-server/`](./dev-server/) | 開発サーバー（npm run dev 等）のライフサイクル管理 |
| [`git/`](./git/) | branch/diff/rebase/merge/push/PR 生成 |
| [`tool/`](./tool/) | ユーザー定義カスタムツールの設定と実行 |
| [`task-template/`](./task-template/) | タスクテンプレート（プリセット） |
| [`variant/`](./variant/) | Executor バリアント設定（model / permissionMode / appendPrompt） |
| [`agent-setting/`](./agent-setting/) | Executor ごとのコマンド設定 |
| [`mcp-config/`](./mcp-config/) | MCP サーバー設定と auto_kanban 自己注入 |
| [`ui-kanban/`](./ui-kanban/) | カンバンボード・タスク詳細・フルスクリーン UI |
| [`ui-settings/`](./ui-settings/) | 設定ページ UI 群 |

---

## 4. 概念カード (Concept Cards)

主要ドメイン用語の**意味と導入意図**は、各ドメインの `xxx_is_yyy` 形式の概念カードに書かれている。
カードには「何を表しているか」「なぜ入れたか」「どう設計したか」の 3 層が含まれる。
これらが意味定義の single source of truth で、他の振る舞いカード（`xxx_is_created` 等）は
該当する概念カードを相互参照する。

| 概念 | カード |
|---|---|
| Project | [project_is_a_git_repository_under_management](./project/project_is_a_git_repository_under_management.md) |
| Task | [task_is_a_unit_of_work_delegated_to_ai](./task/task_is_a_unit_of_work_delegated_to_ai.md) |
| Workspace | [workspace_is_the_isolated_environment_of_an_attempt](./workspace/workspace_is_the_isolated_environment_of_an_attempt.md) |
| Attempt | [attempt_is_the_retry_unit_preserving_history](./workspace/attempt_is_the_retry_unit_preserving_history.md) |
| Session | [session_is_the_bundle_of_agent_runs](./execution/session_is_the_bundle_of_agent_runs.md) |
| CodingAgentProcess | [coding_agent_process_is_one_executor_invocation](./execution/coding_agent_process_is_one_executor_invocation.md) |
| CodingAgentTurn | [coding_agent_turn_is_the_resume_identity](./execution/coding_agent_turn_is_the_resume_identity.md) |
| Approval | [approval_is_the_persistent_tool_confirmation](./approval/approval_is_the_persistent_tool_confirmation.md) |
| Permission | [permission_is_the_ephemeral_control_request](./permission/permission_is_the_ephemeral_control_request.md) |
| Tool | [tool_is_a_user_defined_shell_launcher](./tool/tool_is_a_user_defined_shell_launcher.md) |
| TaskTemplate | [task_template_is_an_initial_task_preset](./task-template/task_template_is_an_initial_task_preset.md) |
| Variant | [variant_is_an_executor_launch_preset](./variant/variant_is_an_executor_launch_preset.md) |
| AgentSetting | [agent_setting_is_the_executor_command_configuration](./agent-setting/agent_setting_is_the_executor_command_configuration.md) |
| DevServerProcess | [dev_server_process_is_a_worktree_scoped_server](./dev-server/dev_server_process_is_a_worktree_scoped_server.md) |
| MCP Injection | [mcp_injection_is_the_agent_context_bridge](./mcp-config/mcp_injection_is_the_agent_context_bridge.md) |

※ `WorkspaceRepo` / `WorkspaceScriptProcess` はサブエンティティとして上記カード内で参照される。

### アーキテクチャルールカード (architecture/)

設計判断を「履歴」ではなく「現時点でこうあるべき」として記録するカード群。
旧 ADR (`docs/adr/`) の役割を継承し、検討された代替案・経緯も含めて一元化する。

| ルール | カード |
|---|---|
| TypeScript 統一 | [typescript_is_the_single_language_across_stack](./architecture/typescript_is_the_single_language_across_stack.md) |
| tRPC プロトコル | [trpc_is_the_client_server_protocol](./architecture/trpc_is_the_client_server_protocol.md) |
| Raw SQL 戦略 | [raw_sql_is_used_instead_of_orm](./architecture/raw_sql_is_used_instead_of_orm.md) |
| 4 層レイヤード | [layered_architecture_separates_model_repository_usecase_presentation](./architecture/layered_architecture_separates_model_repository_usecase_presentation.md) |
| Valtio 採用 | [valtio_is_the_client_local_state](./architecture/valtio_is_the_client_local_state.md) |
| Usecase 6 ステップ | [usecase_is_executed_in_6_steps](./architecture/usecase_is_executed_in_6_steps.md) |
| Specification Pattern | [specification_pattern_composes_db_filters](./architecture/specification_pattern_composes_db_filters.md) |
| embedded-postgres | [postgresql_is_embedded_for_storage](./architecture/postgresql_is_embedded_for_storage.md) |
| auto-kanban.json | [workspace_config_is_auto_kanban_json](./architecture/workspace_config_is_auto_kanban_json.md) |
| テスト戦略 | [tests_are_layered_per_responsibility](./architecture/tests_are_layered_per_responsibility.md) |
| セキュリティモデル | [local_only_security_model](./architecture/local_only_security_model.md) |
| エラーハンドリング (Fail 型) | [fail_type_replaces_exceptions](./architecture/fail_type_replaces_exceptions.md) |
| MCP モード起動 | [mcp_server_starts_from_mcp_flag](./architecture/mcp_server_starts_from_mcp_flag.md) |

### 模範カード (Exemplar)

新しくカードを書くときは以下を参考にする。カードの粒度・節構成・説明の深さの見本:

| タイプ | 模範 | 参考ポイント |
|---|---|---|
| 概念カード (`xxx_is_yyy`) | [`workspace_is_the_isolated_environment_of_an_attempt`](./workspace/workspace_is_the_isolated_environment_of_an_attempt.md) | 概念の「何を表すか」「なぜ導入したか」「設計上の選択」が 3 層構造で書かれている |
| 振る舞いカード | [`execution_is_started_for_task`](./execution/execution_is_started_for_task.md) | 多段 Usecase の全体像を Scenarios で追えつつ、Concept Background で関連エンティティを俯瞰 |
| アーキテクチャルール | [`usecase_is_executed_in_6_steps`](./architecture/usecase_is_executed_in_6_steps.md) | 規約の宣言 + 検討された代替案 + 主要メンバーの典型形 |
| 図を含むカード | [`layered_architecture_...`](./architecture/layered_architecture_separates_model_repository_usecase_presentation.md) | Mermaid `flowchart` を使った正しい例（ASCII アート禁止） |
| 状態遷移カード | [`task_kanban_dnd_transitions_trigger_side_effects`](./ui-kanban/task_kanban_dnd_transitions_trigger_side_effects.md) | Mermaid `stateDiagram-v2` + マトリクス表の組み合わせ |

---

## 5. How to Use

### 読み手向け

```bash
# 検索（glossary.toml の用語が補完ヒントに使われる）
specre search "queue-message"

# ULID から実装へ、実装から ULID へ
specre trace 01KPNSEAVR0V2FXNAGASW9P9FJ
specre trace server/src/usecases/execution/start-execution.ts

# カード一覧と status 集計
specre status
```

ソースコード側の `// @specre <ULID>` マーカーから該当カードへジャンプできる。

### 書き手向け

1. 対応ドメインを決める（なければ `docs/specres/<new-domain>/` を切る）
2. `specre new docs/specres/<domain> --name <subject_verb>` でカード作成
   - `specre.toml` が `language = "ja"` なので、生成されるテンプレは `関連ファイル /
     機能概要 / シナリオ` の日本語見出し
3. front-matter の `status` は `draft` で開始
4. `関連ファイル / 機能概要 / シナリオ / 失敗 / 例外` を記述。
   概念・アーキカードは `シナリオ` の代わりに `設計意図 / 検討された代替案 / 主要メンバー / 関連する動作` を使う
   - `関連ファイル` は **実在する相対パス**のみ
   - 名称（関数名・enum 名・signal 名）は契約として正確に書く
   - 1 カード = 1 動作 または 1 概念。「また〜」が 2 つ以上出たら分割候補
   - **図は Mermaid で書く**（ASCII ボックス図は禁止）
5. 主要 Usecase / tRPC procedure / Callback procedure の直上に `// @specre <ULID>` を付与
   （`specre tag <ULID> <file>` で自動挿入可能）
6. 動作確認ができたら `status: stable` に昇格、`last_verified: YYYY-MM-DD` を記入
7. `bun run specre:index` を実行して index.json / _INDEX.md を更新

### CI 統合（Phase 3 以降）

- `specre health-check` を `bun run check` に追加（Phase 1/2 は warning-only）
- `specre index` を pre-commit hook に追加
- 月 1 で `specre verify` を実行し `last_verified` を更新

---

## 6. Conventions for This Project

- **命名**: snake_case、主語 + 述語（例: `project_is_created_with_repo_path`）、
  または概念カードの場合 `xxx_is_yyy`（例: `workspace_is_the_isolated_environment_of_an_attempt`）。
  主語を省略した `creation_*` や `handle_*` は禁止（検索性が落ちる）
- **1 カード = 1 動作 または 1 概念**: 副作用が 2 つ以上あるなら、それぞれ別カードに分ける
- **関連ファイルは実在パスのみ**: 絶対パスや broken link は `specre drift` で検知される
- **`// @specre` を付ける範囲**: Usecase の export 関数直上、tRPC / Callback procedure 定義直上、
  Model 層のビジネスルール核心（例: `Task.canTransition`）のみ。
  UI コンポーネントや Repository 実装には原則付けない
- **新しい Usecase を追加する PR は、対応する specre を同 PR で追加すること**
- **新しいドメイン概念を足すときは概念カードを先に書くこと**（振る舞いカードが参照先を持てるようにする）
