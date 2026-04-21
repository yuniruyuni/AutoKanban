---
id: "01KPNX4PA4SS8SKP7XWJG3KGVF"
name: "workspace_is_the_isolated_environment_of_an_attempt"
status: "draft"
---

## 関連ファイル

- `server/src/models/workspace/index.ts`
- `server/schema/tables/workspaces.sql`
- `server/src/repositories/workspace/`
- `server/src/repositories/worktree/`

## 機能概要

**Workspace は、1 つの Task の 1 試行（attempt）に紐づく独立した作業環境**である。
Git worktree を 1 つ物理的に持ち、AI エージェントはこの worktree の中でしかコードを触らない。
Task と Workspace は 1:N の関係（同じタスクを何度でも attempt できる）。

## 設計意図

### なぜ 1 attempt = 1 Workspace = 1 Worktree = 1 Branch にしたか

AI コーディング実行を並列化するために最初に解かないといけない問題は
「**同じファイルを複数のエージェントが同時に触って混ざる**」現象。これを防ぐには、
各実行を**物理的に別のディレクトリ**で走らせるしかない。

Git worktree はこの要件に極めてよく適合する:

- リポジトリの `.git` は共有したまま、作業ディレクトリだけ複製できる
- ブランチも独立に checkout できる
- Git の標準 API で add / remove / prune できる（独自の隔離層を被せなくて良い）

これを受けて AutoKanban は:

- **1 attempt = 1 Workspace = 1 Worktree = 1 Branch** の 1:1:1:1 構造を採用
- エージェント実行は必ずこの worktree 内で起き、ユーザーのメインチェックアウトには
  決して影響しない
- 並列 3〜5 本の実行を同時に回しても互いに独立

### なぜ「試行」の単位で切ったか

Task 単位ではなく Workspace という中間層を挟むのは、**やり直しを安全にするため**。
同じ Task で「1 回目失敗 → 2 回目再チャレンジ」というケースが頻繁に起きるが、
このとき 1 回目の成果物（会話、diff、ブランチ）を**丸ごと保全したまま** 2 回目を始めたい。
Workspace を N 個持てるようにすることで、これが自然に実現する。

### なぜ `archived` フラグでソフト削除するか

attempt が積み重なると Workspace が増える。物理削除すると過去の対話と diff が消えて
「何をやって、なぜ失敗したか」が分からなくなる。このため AutoKanban は原則として
`archived: true` のソフト削除だけを使い、ユーザーの明示操作（Project 削除、Chat Reset）の
ときだけ worktree 実体を削除する。

AttemptSwitcher UI は archived な Workspace も表示し、過去 attempt の会話 / diff を
掘り起こせるようにする。

### なぜ `worktreePath` をキャッシュするか

worktree のパスは `worktree.getWorktreePath(workspaceId, projectName)` で計算できるが、
毎回導出するより **1 度作ったパスを Workspace レコードに保存する**方が単純。
worktree 再作成・移動時に差分を検知しやすくなる。

## 主要メンバー

- `id / taskId / attempt / branch`
- `worktreePath: string | null` — worktree 作成後にセットされる物理パス
- `archived: boolean` — ソフト削除フラグ
- `containerRef: string` — project の repoPath 複製（リレーション検索の軽量化）
- `setupComplete: boolean` — prepare スクリプト完了フラグ
- `createdAt / updatedAt`

## 関連する動作

- [attempt_is_the_retry_unit_preserving_history](./attempt_is_the_retry_unit_preserving_history.md) — attempt 概念の詳細
- [workspace_is_created_for_task_attempt](./workspace_is_created_for_task_attempt.md)
- [worktree_is_created_with_branch](./worktree_is_created_with_branch.md)
- [workspace_prepare_script_is_run](./workspace_prepare_script_is_run.md)
- [workspace_cleanup_script_is_run_before_removal](./workspace_cleanup_script_is_run_before_removal.md)
- [workspace_attempts_are_listed_and_archived](./workspace_attempts_are_listed_and_archived.md)
- 関連モデル: `WorkspaceRepo`（Project への junction）
