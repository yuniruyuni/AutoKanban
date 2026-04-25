---
id: "01KPNSJ3RX9X81V6FS6GB9G86R"
name: "tool_is_managed_and_executed"
status: "stable"
last_verified: "2026-04-25"
---

## 関連ファイル

- `server/src/usecases/tool/create-tool.ts`, `list-tools.ts`, `update-tool.ts`, `delete-tool.ts`, `execute-tool.ts`
- `server/src/usecases/tool/execute-tool.test.ts` (Test)
- `server/src/presentation/trpc/routers/tool.ts`
- `server/src/models/tool/index.ts`
- `client/src/pages/settings/ToolsPage.tsx`

## 機能概要

ユーザー定義カスタムツール（任意のコマンド）の CRUD と実行を扱う。
Tool は `{ name, icon, iconColor, command, argv, sortOrder }` を持つ。コマンドは
2 形式あり、`argv` 形式が canonical:

- **argv 形式**（推奨）: `argv: string[]`。`{path}` は各 arg 要素内の literal
  substring として置換され、`Bun.spawn(argv, { cwd })` で **shell を介さず** 起動する。
  パスに空白 / `;` / `$` / バッククォートが含まれていても安全。
- **command 形式**（legacy）: `command: string`。`sh -c` 経由で起動する。`{path}`
  置換時に POSIX shell-escape（`'...'` で囲み内部の `'` を `'\''`）を施し、
  injection と引用崩れを同時に防ぐ。実行時に deprecation 警告をログに出す。

`{path}` は実行時に解決される:
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

### なぜ argv 形式を canonical にしたか

`tool.command.replace(/\{path\}/g, finalPath)` で生成した文字列を `sh -c` に
渡す旧設計は、`finalPath` が空白 / `$` / `;` / バッククォートを含むだけで
コマンドが壊れる、または最悪 injection になる。AutoKanban は local-only だが:

- `repoPath` / worktree path / project name は OS とユーザー入力から来る文字列であり、
  **特殊文字を含む可能性は現実に存在する**（"My Project" のような空白入りディレクトリなど）
- "local-only" は **誤動作削減 / DX** の観点から escape を不要にしない

`argv: string[]` を canonical にすると `{path}` を arg 単位の substring として
置換でき、shell parser が一切介在しないので構造的に安全になる。

### legacy command の互換戦略（自動 split しない）

旧 `command` 形式を残してあるのは互換のため。`"code {path}"` を機械的に
`["code", "{path}"]` に split したくなるが:

- `code -a "/some dir/{path}"` のような **空白を含む引用** を split で正しく
  分解するにはほぼ shell parser を再実装することになる
- 自動 split で意味が変わる（quoting / glob / variable expansion 等）と、
  「いつの間にか別コマンドが走る」という最悪の挙動になる

→ 「警告を出して、ユーザーに手動移行してもらう。実行は引き続き shell 経由で
動かすが、`{path}` だけは shell-escape する」 という妥協を選んだ。

## 主要メンバー

- `Tool = { id, name, icon, iconColor, command, argv, sortOrder, createdAt, updatedAt }`
- `ExecuteToolInput = { toolId, taskId? | projectId? }`
- `ToolRepository.executeCommand(ctx, argv: string[], cwd?)` — argv vector spawn
- `resolveToolInvocation(tool, finalPath)` — argv 形式 / legacy 形式の dispatch + escape

## シナリオ

### 設定ページから CRUD

1. `/settings/tools` で `trpc.tool.list` / `create` / `update` / `delete` を使う
2. UI はドラッグ＆ドロップで `sortOrder` を更新

### task に対して実行（worktree あり）

1. ユーザーがタスクカードのツールメニューから項目を選ぶ
2. `trpc.tool.execute({ toolId, taskId })`
3. `read` で tool / task / project / active workspace を解決
4. `post` で worktree パスを解決して `{path}` 置換、`tool.executeCommand(argv, cwd)` を実行
   - argv 形式: `argv` の各要素で `{path}` を literal 置換 → spawn
   - legacy command 形式: `{path}` を shell-escape → `["sh", "-c", command]` で spawn
5. `{ success, command }` を返却

### project に対して実行（task なし）

1. プロジェクト画面から実行
2. `trpc.tool.execute({ toolId, projectId })`
3. `targetPath = project.repoPath` で `{path}` 置換

## 失敗 / 例外

- `INVALID_INPUT` — taskId / projectId の両方が未指定
- `NOT_FOUND` — tool / task / project
- `INVALID_COMMAND` — 置換後のコマンドが空
- `EXECUTION_ERROR` — 実行時例外（exit code 非 0 など）
