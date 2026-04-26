---
id: "01KQ46NAA0F829KC90BEK8VW3H"
name: "git_operations_serialize_per_repo"
status: "stable"
last_verified: "2026-04-26"
---

## 関連ファイル

- `server/src/infra/concurrency/keyed-lock.ts` (`KeyedLock` プリミティブ)
- `server/src/repositories/git/cli/index.ts` (`GitRepository.repoLock` の static
  registry, `pullBranch` のラップ)

## 機能概要

`GitRepository` は **per-repoPath の mutex**（`KeyedLock`）を持ち、同じ親 repo に対する
git 操作を直列化する。現在の lock 適用範囲は **`pullBranch` のみ**で、別の repoPath への
呼び出しは並列実行可能。

`KeyedLock` は per-key の Promise chain を持つだけの軽量なプリミティブ：

```ts
class KeyedLock {
  runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T>;
}
```

`GitRepository` 側では `static readonly repoLock = new KeyedLock()` として全インスタンス
共有（context.ts と WorktreeRepository が別々に `new GitRepository()` するが、両者は同じ
親 repo に触り得るので registry を共有する必要がある）。

## 設計意図

- **`.git/index.lock` の race を防ぐ**: 短時間に 2 つの PR が GitHub でマージされると、
  webhook 検出 → 2 件の `finalizePrMerge` がほぼ同時に発火する。両者が `pullBranch` 内で
  `git fetch` + `git merge --ff-only` を走らせると、git は `.git/index.lock` を取り合って
  片方が "Another git process seems to be running... Remove .git/index.lock" で失敗する。
  データ破壊はないが、失敗した方の `pullBranch` で `main` が origin より遅れた状態が残る
- **粒度は repoPath**: `.git/index.lock` は repo 単位（branch 単位ではない）。branch 単位に
  細分化しても物理 race は救えないので、最も粗い意味のある粒度として repoPath を選んだ。
  別 repo は当然並列実行可能
- **scope は意図的に狭い**: 現状 `pullBranch` のみラップ。`addWorktree` / `removeWorktree` /
  `pruneWorktrees` 等も同じ親 repo を触るが、今のところ実害が観測されていないので未対応。
  必要になったら同じ `repoLock.runExclusive(repoPath, ...)` でラップを増やすだけ
- **失敗が後続を block しない**: ある holder が例外を投げても KeyedLock は queue 内の例外を
  swallow して次の caller を起こす。1 件の失敗が後続全部を停止させる事故を防ぐ
- **Map entry の自動掃除**: chain の tail 自身が掃除する形にして、idle になった key の
  entry が leak しないようにしている
- **single-process 前提**: AutoKanban は 1 Bun プロセスで動くので process 内 mutex で十分。
  cross-process の同期は scope 外（multi-process 展開する場合は git ネイティブの
  index.lock + retry に頼ることになる）

### 経緯

2026-04-26 より前は `pullBranch` は同じ親 repo に対する並行呼び出しに対して無防備で、
[PR #21][pr21] で `KeyedLock` を導入。同じ PR で発見・修正された
[#18 の pullBranch 修正][pr18]（fetch + merge --ff-only 化）と組み合わせて、`finalizePrMerge`
race の問題を完全に潰している。

[pr18]: https://github.com/yuniruyuni/AutoKanban/pull/18
[pr21]: https://github.com/yuniruyuni/AutoKanban/pull/21

## シナリオ

### 同一 repo への 2 件の `finalizePrMerge` がほぼ同時に走る

1. PR A と PR B がほぼ同時に GitHub でマージ
2. AutoKanban の検出ループが 2 件の `finalizePrMerge` を発火
3. それぞれ `pullBranch(project.repoPath, "main")` を呼ぶ
4. 1 件目が `repoLock.runExclusive(repoPath, ...)` の中で fetch + merge --ff-only を完走
5. 2 件目は 1 件目の終了を待ってから同じ処理を実行（このとき origin/main は既に最新まで
   進んでいるので no-op merge）
6. どちらも成功で終わる

### 異なる repo への並行呼び出し

1. project X と project Y で同時に PR がマージ
2. `pullBranch(repoX, ...)` と `pullBranch(repoY, ...)` が並行起動
3. 別 key なので並列実行され、互いに待たない
4. 各々独立に完了

### 1 件目が例外を投げる

1. `pullBranch(repoPath, "main")` の fetch が一時的なネット障害で失敗
2. KeyedLock は例外を swallow して次の caller を起動（queue 全体は block しない）
3. 続く `pullBranch` 呼び出しは正常な fetch + merge を実行できる

## 失敗 / 例外

- `KeyedLock` 自身は例外を投げない（caller の例外をそのまま伝播し、queue 内の例外は
  swallow して後続を起こす）
- `pullBranch` の失敗パターンは
  [`pull_branch_advances_ref_and_worktree_together`](./pull_branch_advances_ref_and_worktree_together.md)
  を参照

## 関連する動作

- [pull_branch_advances_ref_and_worktree_together](./pull_branch_advances_ref_and_worktree_together.md)
  — ロックでラップされる対象
- [pull_request_is_created_and_finalized](./pull_request_is_created_and_finalized.md) — race
  が発生する元のフロー
