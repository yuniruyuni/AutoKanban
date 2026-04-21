---
id: "01KPNSJ3RX9X81V6FS6GB9G86R"
name: "tool_is_managed_and_executed"
status: "draft"
---

## 関連ファイル

- `server/src/usecases/tool/create-tool.ts`, `list-tools.ts`, `update-tool.ts`, `delete-tool.ts`, `execute-tool.ts`
- `server/src/usecases/tool/execute-tool.test.ts` (Test)
- `server/src/presentation/trpc/routers/tool.ts`
- `server/src/models/tool/index.ts`
- `client/src/pages/settings/ToolsPage.tsx`

## 機能概要

ユーザー定義カスタムツール（任意のシェルコマンド）の CRUD と実行を扱う。
Tool は `{ name, icon, iconColor, command, sortOrder }` を持ち、`command` 内の `{path}` プレースホルダは
実行時に解決される:
- `taskId` 指定: active workspace の worktree パス
- `projectId` 指定: project の `repoPath`
- `taskId` 指定だが workspace 未作成: project の `repoPath` にフォールバック

## 概念的背景: なぜ Tool という概念を足したか

AutoKanban は AI エージェント実行に特化したアプリだが、実際の開発ワークフローには
「AI に任せるのが大袈裟な、でも手で打つのは面倒」な定型操作が多数ある:

- **worktree を VSCode で開く** — AI が書いたコードをレビューしたい
- **Finder / Files で worktree を開く** — ファイルを物理的に探したい
- **テストだけ回す** — dev-server で動かすほどではないが結果を見たい
- **biome fix --unsafe** — lint エラーだけさっと直したい

これらを「AI エージェント経由で実行」させるのは過剰で、「標準の機能として UI に組み込む」のも
ユーザーの好みが分かれる（VSCode 派 / Cursor 派 / vim 派...）。
折衷として、**ユーザー自身がシェルコマンドを登録できる「Tool」**という拡張点を用意した。

なぜ単なる「shell command」ではなく Tool という名前付きエンティティにしたか:

- カンバン UI に 1 クリックで呼べるボタンとして並べたい（`icon`, `iconColor`, `sortOrder`）
- Task / Project どちらに対しても使えるようにしたい（`{path}` の動的解決）
- プロジェクト横断で使い回せるように DB に保存したい（環境変数や alias ではなく）

**`{path}` プレースホルダ**は 1 種類のみに絞った。`{taskId}` や `{branch}` など他の変数を
無数に生やす誘惑はあったが、それは「Tool」の枠を超える（コマンドテンプレート言語を内製することになる）。
必要になったら Tool ではなく専用機能として別に作るべき、という方針。

## 設計意図

- **CLI ランチャ**として使う想定（VSCode を開く、Finder で表示する、テストを実行するなど）
- `{path}` 置換は 1 種類のみ（複雑なテンプレートは未対応）
- 実行はブロッキング呼び出し（長時間のコマンドは dev-server を使うべき）
- `taskId` 指定時に workspace がまだ無ければ `repoPath` にフォールバックするのは、
  「タスクを作ったばかりで Agent 起動前でも、VSCode でリポジトリを開いて確認したい」
  というユースケースに対応するため

## 主要メンバー

- `Tool = { id, name, icon, iconColor, command, sortOrder, createdAt, updatedAt }`
- `ExecuteToolInput = { toolId, taskId? | projectId? }`

## シナリオ

### CRUD via settings page

1. `/settings/tools` で `trpc.tool.list` / `create` / `update` / `delete` を使う
2. UI はドラッグ＆ドロップで `sortOrder` を更新

### Execute against a task (with worktree)

1. ユーザーがタスクカードのツールメニューから項目を選ぶ
2. `trpc.tool.execute({ toolId, taskId })`
3. `read` で tool / task / project / active workspace を解決
4. `post` で worktree パスを解決して `{path}` 置換、`tool.executeCommand(command, cwd)` を実行
5. `{ success, command }` を返却

### Execute against a project (no task)

1. プロジェクト画面から実行
2. `trpc.tool.execute({ toolId, projectId })`
3. `targetPath = project.repoPath` で `{path}` 置換

## 失敗 / 例外

- `INVALID_INPUT` — taskId / projectId の両方が未指定
- `NOT_FOUND` — tool / task / project
- `INVALID_COMMAND` — 置換後のコマンドが空
- `EXECUTION_ERROR` — 実行時例外（exit code 非 0 など）
