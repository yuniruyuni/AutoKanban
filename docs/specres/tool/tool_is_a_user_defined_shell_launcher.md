---
id: "01KPNX4PAESWKFK5KJ0N1S7M9Q"
name: "tool_is_a_user_defined_shell_launcher"
status: "stable"
last_verified: "2026-04-25"
---

## 関連ファイル

- `server/src/models/tool/index.ts`
- `server/schema/tables/tools.sql`
- `server/src/repositories/tool/`
- `client/src/pages/settings/ToolsPage.tsx`

## 機能概要

**Tool は、ユーザーが定義する「任意のシェルコマンドランチャ」を表すエンティティ**である。
タスクカードやプロジェクト画面から 1 クリックで起動でき、コマンド内の `{path}` プレースホルダは
実行時にタスクの worktree パスまたはプロジェクトの repoPath に置換される。

## 設計意図

### なぜ AutoKanban に Tool という拡張点を足したか

AI エージェントに「全部任せる」わけにもいかない定型操作が現実には多い:

- worktree を VSCode で開いてレビュー
- Finder / Files でファイルをエクスプローラ
- テストだけ回す、lint fix だけ当てる
- `gh pr view` で PR の状態を見る

これらは:

- AI に頼むには**オーバーキル**（AI 起動とログ確認のオーバーヘッドが割に合わない）
- 標準機能として AutoKanban に組み込むには**ユーザーの好みが分かれる**（VSCode 派 / vim 派 / Cursor 派）

折衷として、**ユーザー自身がシェルコマンドを登録できる Tool** を拡張点として用意した。

### なぜ「単なる shell command」ではなくエンティティか

単に「設定画面に shell コマンドを書かせる」のではなく、DB エンティティにしたのは:

- アイコン・色・並び順を持たせて **UI のボタンとして並べたい**
- Task と Project のどちらに対しても使えるようにしたい（`{path}` の動的解決）
- プロジェクト横断で再利用したい（環境変数や alias では共有しにくい）

### `{path}` プレースホルダを 1 種類に絞った理由

`{taskId}`, `{branch}`, `{projectName}` など複数のプレースホルダを足す誘惑はあるが、
これを始めると「コマンドテンプレート言語」を内製することになり、責務が膨らむ。

`{path}` だけなら「**どのディレクトリでこのコマンドを実行するか**」という最小で汎用な概念に
閉じる。パス以外の変数が必要になったら、Tool の枠を超えて別機能として切り出すべき、
という方針。

### Task 指定で workspace 未作成時の fallback

`taskId` を渡した場合、通常は active Workspace の worktree パスを `{path}` に入れる。
ただし **workspace がまだ無い（Agent 未起動）** ときは、project の `repoPath` に fallback する。

これは「タスクを作ったばかりで AI を走らせる前に VSCode で下調べしたい」というユースケースを
素直に実現するための仕様。fallback しないと「Agent を起動しないと VSCode で開けない」
という変な制約になる。

### 実行はブロッキング

長時間プロセス（dev server）には不向き。`tool.executeCommand(command, cwd)` は同期的に
実行して exit code を待つ。長時間のものは dev-server 機能を使うべき、という棲み分け。

## 主要メンバー

- `id / name`
- `icon: string` — アイコン名（UI 表示用）
- `iconColor: string` — アイコン色
- `argv: string[] | null` — **canonical なコマンド表現**。各要素は spawn の引数として
  そのまま OS に渡される（shell 非経由）。`{path}` は要素内 substring として置換
- `command: string` — legacy。`sh -c` 経由で実行する場合の生コマンド文字列。`argv`
  が non-null のときは無視される。`{path}` は shell-escape されてから挿入される
- `sortOrder: number` — UI での並び順
- `createdAt / updatedAt`

## 関連する動作

- CRUD + 実行: [tool_is_managed_and_executed](./tool_is_managed_and_executed.md)
