---
id: "01KPNSJ3R9YG1J1XFNB5CPZJR3"
name: "permission_request_is_approved_or_denied"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/usecases/execution/respond-to-permission.ts` (`respondToPermission`, `getPendingPermissions`)
- `server/src/presentation/trpc/routers/execution.ts` (`respondToPermission` procedure)
- `server/src/models/permission/index.ts`
- `server/src/repositories/permission-store/`
- `client/src/components/chat/PermissionResponseInput.tsx`

## 機能概要

Claude Code が **control protocol** 経由で送ってくる in-flight permission request に対し、
AutoKanban が即時応答する経路。DB には永続化されず、`permissionStore` という in-memory ストアのみで
管理される（Executor が生きている間だけ有効）。
比較: [`approval_is_responded_from_approval_card`](../approval/approval_is_responded_from_approval_card.md)
は DB 永続化・UI カード経由、こちらは session TTL 内のフローコントロール。

## 概念的背景: Permission とは何か

Claude Code は `bash`, `write_file`, `read_file` のようなツールを使う前に、
**control protocol** という専用チャネルで「このツールを使って良いか？」と AutoKanban に
問い合わせる。これが **Permission request** で、次の 3 つの特徴を持つ:

1. **同期的**: Claude はこの request を出したあと、応答が来るまで tool 実行を保留する
2. **短命**: Claude Code 側が TTL を管理しており、タイムアウトしたら再発行する
3. **Executor プロセスに閉じる**: そのプロセスが死ねば request も無効になる

この 3 点を満たす永続化として **DB は過剰**。Approval のように「履歴として残す」意図はなく、
「いまこの瞬間、Claude に返事する」ための一時的な参照先があれば良い。
そこで AutoKanban は `permissionStore`（in-memory Map）だけに `requestId → Permission` を
溜めておき、UI からの `respondToPermission` 呼び出しで即座に Executor に control_response を
送り返す。

**なぜ Approval ではなく Permission として扱うか**: 「危険コマンドの承認」のような
ユーザー体験上の重み付けがない、純粋にプロトコル的なハンドシェイクのため。
`--permission-mode plan` のような運用では（本物の Approval とは別に）多数の permission が
飛び交い、これを DB に残すと即ゴミレコードが溜まる。

## 設計意図

Claude Code の control protocol は `request_id` ベースで permission request を送ってくる。
AutoKanban は `permissionStore` を通じて Executor プロセスに `request_id` と共に応答を返し、
`sendPermissionResponse(processId, requestId, approved, requestSubtype?, reason?, ...)` で届ける。

**DB に永続化しない理由**: TTL / タイムアウト管理は Claude Code 側が持っているため、
AutoKanban は中継するだけで良い（残しても stale なレコードになる）。
再起動すると失われるが、Claude Code 側が request を再発行するのでロジック上問題ない。

**`permissionStore.remove(requestId)` を必ず呼ぶ**: 応答後に store から消さないと、
同じ requestId が将来再利用されたときに古い応答が紛れ込むリスクがある。

## シナリオ

### Approve

1. ユーザーが PermissionResponseInput で "Approve" を押す
2. `trpc.execution.respondToPermission({ sessionId, requestId, approved: true })`
3. `read` で session と `latestProcess` の running 状態を検証
4. `post` で `permissionStore.get(requestId)` を取得、なければ `fail("NOT_FOUND")`
5. `executor.sendPermissionResponse(processId, requestId, true, undefined, reason)` で送信
6. `permissionStore.remove(requestId)` で clean up

### Deny

1. `approved: false` + 任意の `reason` を送る

### List pending

1. `trpc.execution.getPendingPermissions({ sessionId })`
2. `permissionStore.listBySession(sessionId)` を返却
3. UI がサイドパネルに表示

## 失敗 / 例外

- `NOT_FOUND` — session または permission request が見つからない
- `INVALID_STATE` — session に running な coding agent process がない
