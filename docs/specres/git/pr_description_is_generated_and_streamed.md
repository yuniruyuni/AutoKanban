---
id: "01KPNSJ3RW522THM9SJXK6HYN3"
name: "pr_description_is_generated_and_streamed"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/usecases/git/generate-pr-description.ts`
- `server/src/usecases/execution/get-draft-pr-delta.ts`
- `server/src/presentation/sse/routers/draft-pr-stream.ts`
- `server/src/models/draft-pull-request/`
- `server/src/models/draft/`
- `client/src/components/task/CreatePullRequestDialog.tsx`

## 機能概要

PR 作成ダイアログで「AI に PR description を書いてもらう」を選んだときに起動する。
Coding Agent の出力を SSE でストリーミングし、ユーザーはリアルタイムで生成を見られる。
生成されたタイトル・本文は draft として保存され、後から編集・再生成が可能。

## 設計意図

- `generate-pr-description` が Coding Agent プロセスを新規に起動
  （通常の実装タスクとは別 session で PR description 専用の prompt を流す）
- 出力は `draft_pull_request` テーブルに保存
- `draft-pr-stream` SSE ルートで delta 配信（`get-draft-pr-delta` usecase 経由）

## シナリオ

### PR 説明生成

1. ユーザーが CreatePullRequestDialog で「Generate description」を押す
2. `trpc.git.generatePRDescription({ workspaceId })`
3. サーバーが専用 agent プロセスを起動、生成結果を draft テーブルに書き込む
4. クライアントは `/sse/draft-pr/<workspaceId>` を購読して delta を受け取る
5. 生成完了後、ユーザーが title/body を編集して Create PR ボタンで確定

## 失敗 / 例外

- agent 起動失敗 → そのまま手動入力
- ストリームが途切れても、draft には部分的な結果が残る（再接続で残りを取得）
