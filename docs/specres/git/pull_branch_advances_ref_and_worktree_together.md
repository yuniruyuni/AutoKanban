---
id: "01KQ46NA9PKBT5W133HP1R1BJP"
name: "pull_branch_advances_ref_and_worktree_together"
status: "stable"
last_verified: "2026-04-26"
---

## 関連ファイル

- `server/src/repositories/git/cli/index.ts` (`pullBranch` 本体, `findWorktreeForBranch`,
  `parseWorktreeForBranch`)
- `server/src/repositories/git/repository.ts` (interface)
- `server/src/usecases/git/finalize-pr-merge.ts` (主な呼び出し元)

## 機能概要

GitHub 上で PR がマージされたあと、AutoKanban は `pullBranch(repoPath, branch)` を呼んで
ローカルの `<branch>` を `origin/<branch>` まで進める。

実装は分岐：

1. `git fetch <remote> <branch>` で remote-tracking ref を最新化
2. `git worktree list --porcelain` で `<branch>` がチェックアウトされている worktree を検索
3. **見つかった場合**: その worktree の cwd で `git merge --ff-only <remote>/<branch>` を実行
   → ref と作業ツリーが同時に進む
4. **見つからなかった場合**: 親リポで `git update-ref refs/heads/<branch> <remote>/<branch>`
   → ref のみ進める（壊すべき作業ツリーがない）

## 設計意図

- **ref と working tree は atomic に進める**: `git update-ref` は plumbing で **作業ツリーに
  触れない**。親リポで `main` がチェックアウト中の状態で `update-ref` を呼ぶと、ref は新しい
  commit を指すのに作業ツリーは古いままという不整合状態が生まれ、`git status` 上では新規
  マージされた変更が「逆向きの diff」として全部出てきてしまう。AutoKanban の運用では親リポで
  main を見るのが普通なので、これが累積するとユーザーが混乱する
- **dirty worktree は壊さない**: `git merge --ff-only` は uncommitted な変更が fast-forward と
  衝突する場合に "Your local changes would be overwritten" で失敗する。silent に上書きせず
  エラーで surface するので、意図しないユーザーの作業損失が起きない
- **`git pull` を使わない**: 素の `git pull` は diverge 時に勝手に merge commit を作るため、
  ローカル main に origin に存在しない history を混入させ得る。`fetch + merge --ff-only` は
  `git pull --ff-only` と等価で、divergence を検知して fail する方が安全
- **Detached / 未チェックアウトには update-ref で十分**: 該当 branch がどの worktree にも
  チェックアウトされていない場合は作業ツリーの整合性を考える必要がないので、ref のみの
  軽量な advance で十分

### 経緯

2026-04-26 より前は `pullBranch` は単純な `fetch + update-ref` だった。`finalizePrMerge` が
PR マージのたびに親リポの `main` ref を進めていたが作業ツリーは古いままで、約 10 件の PR
マージを跨いで作業ツリーが大きくドリフトする問題が発生（[PR #18][pr18]）。本動作仕様は
その修正の結果。

[pr18]: https://github.com/yuniruyuni/AutoKanban/pull/18

## シナリオ

### 親リポで main がチェックアウトされている（典型）

1. ユーザーが GitHub で PR を merge
2. AutoKanban が `finalizePrMerge` を発火 → `pullBranch(project.repoPath, "main")`
3. `git fetch origin main` で `refs/remotes/origin/main` を更新
4. `git worktree list --porcelain` が親リポの worktree を `branch refs/heads/main` として返す
5. 親リポ内で `git merge --ff-only origin/main` → ref と作業ツリーが同時に最新化
6. `git status` は clean のまま

### feature branch を別 worktree で開発中、その branch を pull したい

1. 何らかの fix 用に feature branch も同様に `pullBranch(repoPath, "feature-x")`
2. `feature-x` が `~/.auto-kanban/worktrees/.../feature-x` でチェックアウトされていれば、
   そちらの worktree で fast-forward
3. その worktree の作業ツリーも進む

### 該当 branch がチェックアウトされていない

1. `pullBranch(repoPath, "develop")` が呼ばれるが、`develop` はどの worktree にも
   出ていない
2. `findWorktreeForBranch` が null を返す
3. 親リポで `git update-ref refs/heads/develop origin/develop` のみ実行
4. ref が進む。作業ツリーは関係ない（壊すべきものがない）

## 失敗 / 例外

- `Failed to fetch branch: ...` — `git fetch` 自体が失敗（ネット / 認証 / 不正 ref）
- `Failed to fast-forward <branch> at <path>: ...` — fast-forward 不可能。**典型ケース**:
  - ローカル main に origin にないコミットが乗っている（divergence）
  - 作業ツリーに uncommitted で fast-forward と衝突する変更がある
- `Failed to update ref: ...` — チェックアウトされていない経路での `update-ref` 失敗

## 関連する動作

- [git_operations_serialize_per_repo](./git_operations_serialize_per_repo.md) — 並行マージ時の
  `.git/index.lock` race を防ぐため `pullBranch` は `repoPath` 単位で直列化される
- [pull_request_is_created_and_finalized](./pull_request_is_created_and_finalized.md) — finalize
  フローの一部として呼ばれる
