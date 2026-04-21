---
id: "01KPNSJ3Q8W98006R0TNQGFAE8"
name: "workspace_is_created_for_task_attempt"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/usecases/execution/start-execution.ts` (workspace 作成ロジック)
- `server/src/models/workspace/index.ts` (`Workspace.determineAttemptStrategy`, `Workspace.create`, `generateBranchName`)
- `server/src/repositories/workspace/`
- `server/src/models/workspace-repo/index.ts`

## 機能概要

タスクの実行要求ごとに「作業環境」である Workspace を確保する。
既存 active workspace があってまだセッションが無ければ再利用（`reuse`）、
セッションが既にあれば新しい attempt 番号で作成（`new`）し、前の workspace は `archived: true` に落とす。
新規作成時は `WorkspaceRepo` も同時に作って Project との junction を張る。

## 概念的背景: Workspace と Attempt

AutoKanban における「タスクを AI にやらせる」は、実際には **「そのタスクの N 回目の試行を
独立した環境で走らせる」** という意味を持つ。ここで言う *試行 = attempt* を物理的に支えるのが
Workspace エンティティで、**1 attempt = 1 Workspace = 1 Git worktree = 1 ブランチ**
の 1:1:1:1 構造で常に対応が取れる設計になっている。

なぜこの粒度で切ったか:

- **並列化の独立性**: 複数 attempt を同時に走らせても、worktree が物理的に別ディレクトリなので
  ファイルの書き込みが混ざらない。AI 実行を並行させるというプロダクトの中核機能を、
  設計レベルで保証している
- **やり直し可能性**: 1 回目が失敗した / 気に入らなかったとき、ユーザーはただ 2 回目の attempt を
  作ればよい。1 回目の worktree・ブランチ・会話履歴はそのまま残るので、比較や参照ができる
- **Git diff の自然さ**: attempt ごとにブランチが分かれているので、AI の変更を `main...attempt-N` で
  そのまま diff できる。追加の差分計算ロジックを AutoKanban 側に持たなくて良い

## 設計意図

戦略判定（`Workspace.determineAttemptStrategy`）を Model 層に置き、
「reuse（再利用） / new（新 attempt 作成）」の決定ロジックを 1 箇所に集約している。
分岐の判断材料は**「active workspace にセッションが既にあるか否か」**の 1 点だけで、
これは「1 度でも Coding Agent が走った形跡があれば、それは履歴として保全する」という
不可逆性ルールを表している。

`archived: true` で前の workspace を**物理削除ではなくソフト削除**にする理由: 過去 attempt の
対話・diff・ログは **ユーザーにとって資産**（失敗パターンの学習材料、PR 説明の材料）であり、
自動では消さない。worktree 自体の削除は別途 Chat Reset 経路（`todo` への遷移）や
プロジェクト削除時にまとめて行う。

## 主要メンバー

- `Workspace.determineAttemptStrategy({ activeWorkspace, activeHasSessions, maxAttempt, taskId, containerRef })`
- `WorkspaceRepo.create({ workspaceId, projectId, targetBranch })`
- `Session.create({ workspaceId, executor, variant })`

## シナリオ

### 初回 attempt

1. taskId の workspace が 1 件も存在しない
2. `determineAttemptStrategy` が `action: "new"`、`attempt: 1` を返す
3. Workspace / WorkspaceRepo / Session を全て create し、write ステップで upsert

### 追加 attempt（前回実行後）

1. `activeWorkspace` あり、`activeHasSessions: true`
2. `action: "new"`、`workspaceToArchive: activeWorkspace`、`attempt: maxAttempt + 1`
3. write で前の workspace を `archived: true` に更新し、新 workspace を upsert

### 既存 attempt の再利用（resume）

1. `activeWorkspace` あり、`activeHasSessions: false`（セッション未着手）
2. `action: "reuse"`
3. 既存 workspace をそのまま使い、新しい session だけ作る

## 失敗 / 例外

- 実質的な失敗は親 `startExecution` 側の NOT_FOUND / WORKTREE_ERROR などに委ねる
