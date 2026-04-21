---
id: "01KPNX4PACA9S29SQDJ441E6V7"
name: "permission_is_the_ephemeral_control_request"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/models/permission/index.ts`
- `server/src/repositories/permission-store/`
- `client/src/components/chat/PermissionResponseInput.tsx`

## 機能概要

**Permission は、Claude Code の control protocol 経由で届く in-flight な権限リクエストを表す
揮発的な概念**である。`permissionStore`（in-memory Map）でのみ管理され、DB には保存されない。
`{ requestId, toolName, toolInput, requestedAt, timeoutMs }` を持ち、
`requestId` で応答を識別する。

## 設計意図

### Approval ではなく Permission として扱う理由

Claude Code が `bash`, `write_file` などのツールを使う前に、`request_id` ベースの
**control protocol** で「このツールを使って良いか？」と聞いてくる。これが Permission。

Permission の性質:

- **同期的**: Claude はレスポンスが来るまでツール実行を保留する
- **短命**: Claude Code 側が TTL を管理し、タイムアウト後は再発行される
- **Executor プロセスに閉じる**: プロセスが死ねば request は無効

これらは「履歴として残したい承認」ではなく**プロトコル的な即時ハンドシェイク**。
Approval のように DB に保存すると、TTL 切れの stale レコードがすぐ溜まる。

### なぜ in-memory Map で十分か

- Claude Code 側が request 管理の source of truth（TTL、再発行）
- サーバー再起動時に in-memory が消えても、Claude Code が request を再発行するので破綻しない
- 高速な `requestId` ルックアップ（O(1)）で応答できる

DB にする必要があるのは「後で振り返りたい」情報だが、Permission は振り返る価値が低い
（ツール使用ごとに発生し、数秒で消費される）。

### `requestId` ベースの応答が必須

`requestId` は Claude Code の control protocol の制御 ID で、response は必ずこの ID と
対応させる必要がある。`toolCallId`（ツール呼び出し側の ID）と混同して送ると
Claude Code 側が無視する（仕様上の微妙な点）。したがって `executor.sendPermissionResponse` は
必ず `requestId` を使うことが契約。

### 応答後に `permissionStore.remove(requestId)` を呼ぶ

応答後に store から消さないと、同じ requestId が後で再利用されたときに古い応答が残って
誤動作する可能性がある。remove は応答フローの最後に必ず呼ぶ。

## 主要メンバー

- `requestId: string` — control protocol の制御 ID（応答時のキー）
- `toolName: string`
- `toolInput: unknown` — ツール入力引数
- `requestedAt: Date`
- `timeoutMs: number | null`
- Store メソッド: `permissionStore.get(requestId)` / `listBySession(sessionId)` / `remove(requestId)`

## 関連する動作

- 応答: [permission_request_is_approved_or_denied](./permission_request_is_approved_or_denied.md)
- 対比: [approval_is_the_persistent_tool_confirmation](../approval/approval_is_the_persistent_tool_confirmation.md)
