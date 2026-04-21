---
id: "01KPNSJ3QAMNPEM9FR0G5MZ26F"
name: "worktree_is_created_with_branch"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/repositories/worktree/` (`ensureWorktreeExists`, `getWorktreePath`, `removeAllWorktrees`, `pruneWorktrees`)
- `server/src/usecases/execution/start-execution.ts` (`post` ステップで worktree 作成)
- `server/src/models/workspace/index.ts` (`generateBranchName`)

## 機能概要

Workspace に対応する Git worktree ディレクトリを作成する。起点ブランチ（`targetBranch`、通常 `main`）を元に、
`autokanban/<taskId>/attempt-<n>` のような専用ブランチを切り、そのブランチを作業ブランチとして
worktree を checkout する。

## 概念的背景: なぜ worktree なのか

Git worktree は 1 つのリポジトリに対して **複数の作業ディレクトリ**を紐付ける機能で、
各作業ディレクトリは独立したブランチを checkout した状態になれる。通常の `git clone` や
`git stash` + `git checkout` との違いは次の 3 点で、AutoKanban の要件にきれいに噛み合う:

- **リポジトリ本体を共有**: `.git` を別ディレクトリに複製しないので、大きなリポジトリでも
  ディスク使用量が小さい。pack-files や LFS オブジェクトは元のリポジトリから参照される
- **並行 checkout**: ユーザー自身が main でコーディング中でも、AutoKanban は worktree で
  別ブランチに出て AI を走らせられる。お互いのファイル状態を一切干渉させない
- **標準 Git API で完結**: 独自の隔離層（コンテナ、chroot など）を被せる必要がなく、
  Git の普通のコマンドで add / remove / prune できる

ここから AutoKanban の方針が決まる: **「1 attempt = 1 worktree = 1 ブランチ」を厳守し、
AI エージェントはこの worktree の中でしかファイルを触らない**。これにより、ユーザーの
作業ディレクトリが AI の変更で壊れることが設計上ありえなくなる。

## 設計意図

- `ensureWorktreeExists` は **冪等**（既にあれば再作成しない）。再起動や attempt 再利用時に
  worktree の整合性を気にせず呼べる
- `removeAllWorktrees(wsId, projects, force, deleteBranch?)` の `deleteBranch` フラグで
  「ブランチは残して worktree ディレクトリだけ消す」を選べる。
  これが Chat Reset 経路（`todo` への遷移）の肝で、**会話は捨てるが Git 履歴は保全する**という
  ユーザー期待を満たす
- 作成は `start-execution` の post ステップに置く。DB トランザクション内で `git worktree add`
  を走らせないのは、worktree 作成に数秒〜掛かり得るためトランザクションを引き延ばしたくないから

## シナリオ

### Worktree creation in post step

1. `startExecution` の post で `worktree.ensureWorktreeExists(workspace, project, targetBranch)` を呼ぶ
2. 内部で `git worktree add <path> <branch>`（ブランチが無ければ `-b` で作成）を実行
3. 戻り値の worktree パスを `workspace.worktreePath` に保存する finish を予約

### Worktree failed

1. 作成時に何らかの Git エラー（同名 path 衝突、disk full 等）
2. `fail("WORKTREE_ERROR", "Failed to create worktree for <project>: <error>")`

### Pruning after removal

1. Chat Reset や worktree 強制削除の後、`worktree.pruneWorktrees(project)` を呼ぶ
2. Git 管理上の stale worktree entry を除去

## 失敗 / 例外

- `WORKTREE_ERROR` — worktree 作成の各種失敗
