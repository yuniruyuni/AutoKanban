---
id: "01KPNX4PA6R6NBTA73WJ9EFRRV"
name: "attempt_is_the_retry_unit_preserving_history"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/models/workspace/index.ts` (`determineAttemptStrategy`, `generateBranchName`, `attempt` フィールド)
- `server/src/usecases/execution/start-execution.ts` (attempt 決定ロジック)
- `client/src/components/chat/AttemptSwitcher.tsx`

## 機能概要

**Attempt は、1 つの Task に対する「N 回目の実行試行」を表す概念**である。
物理的には Workspace エンティティの `attempt: number` フィールド（1 始まり）で表され、
`autokanban/<taskId>/attempt-<n>` のようなブランチ名に対応する。Task 1 件に対して
N 個の Workspace が存在しうる（過去 attempt は `archived: true` で保持）。

## 設計意図

### なぜ attempt をファーストクラスの概念にしたか

「AI に 1 回頼んで 1 回完璧な答えが返ってくる」ことは現実にはほぼない。
実際には:

- 1 回目の AI 実行で方針が違う → やり直したい
- 1 回目と 2 回目を並べて比較したい
- 複数の Variant（plan モード vs 通常モード）で同じタスクを試したい
- rebase で競合して続けられないので、新しいブランチから作り直したい

これらを**情報を失わずに**実現するには、「やり直し」が破壊的更新ではなく、
**新しい attempt の作成**として表現される必要がある。新 attempt を作ると:

- 新しい worktree が切られる（クリーンな状態から始まる）
- 前の Workspace は `archived: true` で残る（会話 / diff / ブランチが保全）
- 新しいブランチが `main` から切られる（前の attempt の変更を引き継がない）

### `determineAttemptStrategy` が単一の真実

attempt を新規に作るか、既存 active を再利用するかの判断は
`Workspace.determineAttemptStrategy({ activeWorkspace, activeHasSessions, maxAttempt, ... })`
1 箇所に閉じ込められている。ルールは単純:

- active Workspace が **未セッション**（1 回も走ってない） → `reuse`（再利用）
- active Workspace が **セッションを持つ**（1 度でも走った） → `new`（新 attempt）、
  active は archive に落とす

このルールの言い換え: **「実行履歴が付いた Workspace は不可逆に保全する」**。
実行後の Workspace を上書きしないことで、attempt の履歴性を保証する。

### ブランチ名の規則性

`generateBranchName(taskId, attempt)` が `autokanban/<taskId>/attempt-<n>` 形式を生成。
この規則性により:

- Git で branch 一覧を見れば attempt 一覧がそのまま見える
- `git branch -D autokanban/xxx/attempt-1` で過去 attempt を手動で消しやすい
- 人間が worktree パスを見て「これは何 attempt 目か」が分かる

ブランチ名に UUID や短縮 hash を使う選択肢もあったが、**人間可読性**を優先した。

## 主要メンバー

- `attempt: number` — 1 始まりのカウンタ（`maxAttempt + 1` で新 attempt を作る）
- Workspace の `archived` フラグと組み合わせてライフサイクルを表現
- `generateBranchName(taskId, attempt): string` — ブランチ名生成
- `determineAttemptStrategy(...): { action: "new" | "reuse", workspace, workspaceToArchive? }`

## 関連する動作

- [workspace_is_the_isolated_environment_of_an_attempt](./workspace_is_the_isolated_environment_of_an_attempt.md) — 物理的な容れ物である Workspace
- [workspace_is_created_for_task_attempt](./workspace_is_created_for_task_attempt.md) — 新 attempt 作成フロー
- [execution_is_started_for_task](../execution/execution_is_started_for_task.md) — attempt 戦略の適用点
- [workspace_attempts_are_listed_and_archived](./workspace_attempts_are_listed_and_archived.md) — AttemptSwitcher 用
