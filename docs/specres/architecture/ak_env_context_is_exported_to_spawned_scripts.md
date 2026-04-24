---
id: "01KPZT8XW9MWN21TTAE1AFS3YF"
name: "ak_env_context_is_exported_to_spawned_scripts"
status: "stable"
last_verified: "2026-04-23"
---

## 関連ファイル

- `server/src/repositories/dev-server/repository.ts` (`AkSpawnContext` 型、`start()` シグネチャ)
- `server/src/repositories/dev-server/process/index.ts` (`Bun.spawn` に `AK_*` 環境変数を注入)
- `server/src/usecases/dev-server/start-dev-server.ts` (`context: { taskId, workspaceId, projectId }` を渡す呼び出し元)
- `server/src/usecases/workspace/run-workspace-script.ts` (同上、`prepare` / `cleanup` スクリプト側)
- `auto-kanban.json`（プロジェクト側で `$AK_*` を参照するスクリプト）

## 機能概要

`auto-kanban.json` の `prepare` / `server` / `cleanup` スクリプトとして AutoKanban が起動する
子プロセスには、そのプロセスがどの AutoKanban 実行コンテキストに属しているかを示す
`AK_*` 環境変数が必ず注入される。

| 変数 | 意味 |
|---|---|
| `AK_PROCESS_ID` | 子プロセスに対応する `WorkspaceScriptProcess` / `DevServerProcess` の id |
| `AK_SESSION_ID` | 親 session の id |
| `AK_TASK_ID` | task の id |
| `AK_WORKSPACE_ID` | 実行中 workspace (attempt) の id |
| `AK_PROJECT_ID` | project の id |
| `AK_WORKTREE_PATH` | 子プロセスの `cwd` にもなっている worktree 絶対パス |

## 設計意図

### なぜ「環境変数」として渡すか

- `auto-kanban.json` は**プロジェクト側が自由に書ける**シェルコマンドをキックするだけの薄いブリッジ。
  AutoKanban が個別のプロジェクト都合（ポート選択 / 状態ディレクトリ / マルチテナント等）を
  知らなくて済むよう、プロジェクト側が自分で条件分岐できる **汎用のコンテキスト**だけを提供する
- 環境変数は POSIX シェルでも Node / Bun / Python からでもそのまま読めるため、
  言語・ランナー非依存の契約としてコストが最小

### なぜこの 6 個か（スコープの線引き）

- **AutoKanban が保証できる事実** のみ: 「このプロセスは `AK_PROCESS_ID` の process entity に対応している」
  「同一 task / workspace / project に属している」は AutoKanban 側で常に決まる
- **agent が扱うかもしれない値や動的状態** (session 内の turn / 承認ポリシー / ログ) は含めない:
  スクリプトの責務ではないし、contract が肥大化すると後で剥がすのが難しくなる
- `AK_WORKTREE_PATH` はスクリプトの `cwd` と同じだが、`cd` された後でも元のパスを引けるよう明示
- **`AK_PROCESS_TYPE` は入れない**: `processType: "devserver" | "workspacescript"` は
  AutoKanban 内部の分岐に使う値で、スクリプト側から見たら起動された script key
  (`prepare` / `server` / `cleanup`) の方が自然。起動コンテキストで分かるので冗長

### 利用例（このリポジトリ自身での dogfood）

`scripts/start-preview.sh` が `AK_PROCESS_ID` の有無で分岐し、子 AutoKanban に
`AUTO_KANBAN_HOME=/tmp/auto-kanban-preview-${AK_WORKSPACE_ID}-${AK_PROCESS_ID}` を設定する
ことで親と状態を分離している
([auto_kanban_home_isolates_instances](./auto_kanban_home_isolates_instances.md))。
AutoKanban 自身は「この env がある = 分離したい」を知らない — プロジェクト側が自分で決める。

### 流れ

1. Usecase (`start-dev-server` / `run-workspace-script`) の `read` / `process` ステップで
   `task` / `workspace` / `project` を解決
2. `post` で `ctx.repos.devServer.start({ ..., context: { taskId, workspaceId, projectId } })`
3. `DevServerRepository.start()` が `Bun.spawn` の `env` フィールドに `AK_*` 6 変数を組み立てて注入
4. 子プロセスはそのまま `$AK_*` で参照できる

## 失敗 / 例外

- 環境変数が 1 つでも欠けると仕様違反（`context` 引数は型で必須化されており、省略は型エラー）
- 値そのものは string として渡すだけなのでバリデーションは無し（プロジェクト側の責務）

## 関連する動作

- [auto_kanban_home_isolates_instances](./auto_kanban_home_isolates_instances.md) — `AK_PROCESS_ID` を鍵にした分離の代表例
- [dev_server_lifecycle_is_managed](../dev-server/dev_server_lifecycle_is_managed.md)
- [workspace_prepare_script_is_run](../workspace/workspace_prepare_script_is_run.md)
- [workspace_config_is_auto_kanban_json](./workspace_config_is_auto_kanban_json.md)
