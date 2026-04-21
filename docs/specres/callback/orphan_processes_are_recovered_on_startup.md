---
id: "01KPQBJQ1973HTVE0R7YWN26M9"
name: "orphan_processes_are_recovered_on_startup"
status: "draft"
---

## 関連ファイル

- `server/src/usecases/setup/recovery.ts` (`recoverOrphanedProcesses`)
- `server/src/index.ts` (起動フローの一部)
- `server/src/models/task/index.ts` (`inreview` への遷移)
- `server/src/models/coding-agent-process/index.ts` (`killed`)

## 機能概要

AutoKanban が起動するたび、前回異常終了した時点で `running` / `awaiting_approval` だった
プロセスと、`pending` だった approval を **一括で整理する**。対象:

- `coding_agent_processes`: `running` / `awaiting_approval` → `killed`, `completed_at` 付与
- `dev_server_processes`: `running` → `killed`
- `workspace_script_processes`: `running` → `killed`
- 上記に紐づくタスク: `inprogress` / `inreview` → `inreview` に統一（人間確認待ち）
- `approvals`: `pending` → `denied` (理由 "Server restarted")

**1 トランザクションで全て行う**ことで途中状態に残らない。
`ctx.db.transaction(async (tx) => ...)` を直接使う珍しいケース（標準の Repository メソッドを
跨ぐ bulk UPDATE のため）。

## 設計意図

- **DB の状態と OS プロセスの乖離を起動直後に解消する**: サーバーが落ちると Executor
  サブプロセスも死ぬが、DB 上の `running` フラグは残ったまま。放置すると「running なのに
  ログが来ない」というゾンビ状態になるので、起動直後に整理して「人間が見れば分かる」状態に戻す
- **タスクは `inreview` に集約**: `killed` になった process に紐づくタスクは一様に `inreview` へ。
  ユーザーが起動後にカンバンを見れば「判断待ちのタスクがあるな」と気付ける
- **Pending approval は denied + reason**: 再起動後は in-memory Promise が失われているため、
  たとえ UI から "approve" しても Executor は既に不在。
  `denied + reason: "Server restarted"` として閉じ、ユーザーが queueMessage で続きを再開する流れ
- **トランザクション内で完結**: 4 テーブルに跨る bulk UPDATE を個別トランザクションにすると
  途中失敗で中途半端な状態になる。`recoverOrphanedProcesses` が単一の `ctx.db.transaction`
  内で全部やる
- **Repository 標準メソッドを経由しない**: upsert ではなく直接 SQL UPDATE を書くのは、
  「ID を 1 件ずつ pull して upsert」だと O(N) クエリになり起動時間が無駄に伸びるため。
  Repository 層の規約からは例外

## シナリオ

### 正常な再起動

1. ユーザーが AutoKanban を起動（前回 Ctrl-C や OS 再起動で落ちていた）
2. `initDatabase()` → `createContext()` → `recoverOrphanedProcesses(ctx)` が順に実行される
3. `coding_agent_processes.status` が全部 `killed` に
4. 対応タスクが `inreview` に集約
5. pending approvals が `denied` に
6. カンバンを開くと `inreview` 列に「要確認」タスクが並ぶ
7. ユーザーが各タスクで follow-up message を送ると resume が起動

### クラッシュで残った worktree

1. recovery 自体は DB レコードのみ触る。worktree ディレクトリは残ったまま
2. 次に該当タスクの attempt を動かすときに `determineAttemptStrategy` が既存 workspace を
   再利用して resume する（worktree 整合性は Git 側で判定）

## 失敗 / 例外

- DB 接続失敗 → 起動自体が失敗（`initDatabase` で検出）
- トランザクション失敗 → 起動を中止、ユーザーにログで通知
- OS プロセスが実はまだ生きているレアケース（別ユーザー起動など） → recovery 後に stdout が
  届いても process が `killed` なので logStore が close されており、黙殺される
