---
id: "01KPNSJ3QQHP6GHD2JHE1RK26C"
name: "conversation_is_forked_at_message"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/usecases/execution/fork-conversation.ts`
- `server/src/usecases/execution/get-conversation-history.ts`
- `server/src/presentation/trpc/routers/execution.ts` (`forkConversation` procedure)
- `server/src/models/coding-agent-turn/index.ts`

## 機能概要

過去のメッセージ位置（`messageUuid`）から会話を分岐し、新しい prompt で続行する。
Claude Code の `--resume <sessionId>` + `--resume-session-at <messageUuid>` フラグを使って
「過去のあるポイントに巻き戻して別の方向に進める」機能。
新しい CodingAgentProcess / CodingAgentTurn を作成し、新プロセスを起動する。

## 概念的背景: Fork の存在意義

AI との長い対話では「ここまでは良かったが、あの判断で変な方向に行った」という瞬間が頻繁にある。
そこで従来の手段は 2 つしかなかった:

1. **最初からやり直す** — 前半の正しい判断も捨てることになり、時間と token を浪費する
2. **そのまま continue して軌道修正をお願いする** — AI が「しかし先ほど決めた方針では…」と
   過去の方針に引きずられがち

Fork はこれらの折衷で、「過去のある時点の会話状態を固定したまま、そこから別方向に分岐する」
操作を第一級機能にしている。用途の典型:

- Plan モードで立てた計画のある実装ステップで AI が暴走したので、その手前まで戻して
  別の prompt で指示し直す
- テストが失敗した原因の仮説を複数並行で試す（attempt でもよいが、attempt は worktree 作り直しが
  伴うので重い。fork は同じ worktree・同じ会話前半で軽く試せる）

重要なのは **fork 前のプロセス / 会話は削除せず残す** こと。後から「やっぱり fork じゃなくて
元の続きが正解だった」と気付いたときに戻れるようにする。

## 設計意図

「AI の回答が気に入らないので、別の質問で試したい」を DB 履歴ごと安全に行うための仕組み。
Fork 前のプロセスはそのまま残る（履歴として参照可能）。プロセスが running の間は fork 不可
（`INVALID_STATE`）。

**なぜ running 中は fork を禁止するか**: 走っているプロセスに対して `--resume-session-at` で
別プロセスを立ち上げると、同じ `agentSessionId` を 2 本の実プロセスが奪い合う状態になり、
Claude Code 側の状態管理が壊れるリスクがある。Stop → fork の順序を強制することで
プロセス状態の矛盾を防ぐ。

## 主要メンバー

- `sessionId: string`
- `messageUuid: string` — 巻き戻し先のメッセージ UUID
- `newPrompt: string`

## シナリオ

### フォーク成功

1. ユーザーがメッセージの「ここから分岐」メニューを選ぶ
2. `trpc.execution.forkConversation({ sessionId, messageUuid, newPrompt })`
3. `read` で latestProcess が running でないことを検証、resumeInfo を取得
4. `process` で新 CodingAgentProcess / CodingAgentTurn を作成
5. `write` で両方を upsert
6. `post` で `executor.startProtocol({ resumeSessionId, resumeMessageId: messageUuid, prompt })` 起動

### 実行中はフォーク不可

1. `latestProcess.status === "running"`
2. `fail("INVALID_STATE", "Cannot fork while process is running")`

## 失敗 / 例外

- `NOT_FOUND` — session / latestProcess / workspace が存在しない
- `INVALID_STATE` — running プロセスが存在する、または resumeInfo が無い（`agentSessionId` 必須）
