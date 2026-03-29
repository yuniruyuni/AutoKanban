# チャットインターフェイス機能ギャップ分析

## 概要

Auto KanbanはClaude Codeを統合したタスク管理アプリである。本プランでは、Coding Agentがチャット上で提示するアクションやUI機能のうち未実装のものを洗い出し、実装TODOとして整理する。

---

## 機能ギャップ一覧

### 1. AskUserQuestion の専用レンダリング

- **現状**: `AskUserQuestion`ツールは`tool-action-mapper.ts`で明示的にマッピングされておらず、`generic`アクションとしてレンダリングされる
- **あるべき姿**: エージェントからの質問を専用UIで表示し、ユーザーがテキスト入力で回答できるカードを表示する
- **仕様**: [14-chat-interface.md](./14-chat-interface.md) — AskUserQuestion専用カード セクション
- **実装TODO**:
  - `server/src/lib/tool-action-mapper.ts` に `AskUserQuestion` → `ask_user` マッピング追加
  - `server/src/types/conversation.ts` と `client/src/components/chat/types.ts` に `ask_user` アクション型追加
  - `client/src/components/chat/AskUserCard.tsx` 新規作成
  - `client/src/components/chat/AskUserResponseInput.tsx` 新規作成

### 2. Approval Timeout（承認タイムアウト）

- **現状**: 承認リクエストにタイムアウトなし（永久に待ち続ける）
- **あるべき姿**: 一定時間応答がない場合、自動的にタイムアウト処理を実行
- **仕様**: [14-chat-interface.md](./14-chat-interface.md) — approvalsテーブル、PermissionResponseInput セクション
- **実装TODO**:
  - `server/src/models/approval.ts` に `timeoutAt` フィールド追加
  - `server/schema.sql` の`approvals`テーブルに `timeout_at` カラム追加
  - Permission/Approval処理でタイムアウトチェック追加
  - `PermissionResponseInput.tsx` にタイムアウトカウントダウン表示追加

### 3. Session Fork UI（ユーザーメッセージ編集による会話分岐）

- **現状**: `forkConversation` エンドポイントは存在するが、UIからユーザーメッセージを編集して分岐するUIがない
- **あるべき姿**: ユーザーメッセージにeditボタンを表示、インライン編集で会話を分岐
- **仕様**: [14-chat-interface.md](./14-chat-interface.md) — メッセージ編集/リトライ（Session Fork） セクション
- **実装TODO**:
  - `client/src/components/chat/UserMessage.tsx` に編集/リトライボタン追加
  - `client/src/components/chat/RetryEditor.tsx` 新規作成
  - 既存の`forkConversation`エンドポイントとの接続

### 4. Code Review フロー

- **現状**: 未実装
- **あるべき姿**: エージェント作業完了後、コードレビューを依頼可能
- **仕様**: [07-core-features.md](./07-core-features.md) — コードレビューフロー セクション
- **実装TODO**:
  - `server/src/usecases/execution/start-review.ts` 新規作成
  - `server/src/presentation/routers/execution.ts` に `startReview` エンドポイント追加
  - `client/src/components/chat/StartReviewDialog.tsx` 新規作成
  - NextActionCardにレビュー開始ボタン追加

### 5. Dev Server統合

- **現状**: バックエンドにDevServerスクリプト管理は存在するが、チャットUIからの制御が限定的
- **あるべき姿**: チャットUIから開発サーバーの起動・停止、ステータス表示
- **仕様**: [07-core-features.md](./07-core-features.md) — Dev Server統合 セクション
- **実装TODO**:
  - `client/src/hooks/useDevServer.ts` 新規作成
  - ChatHeaderにDevServerステータスインジケーター追加
  - NextActionCardにDevServer制御ボタン追加

### 6. Script実行の体系化

- **現状**: setup/cleanup/dev-serverスクリプトは存在するが、チャットUI上でのスクリプト実行・結果表示が限定的
- **実装TODO**:
  - スクリプト実行をツールアクションとして表示するマッピング追加
  - NextActionCardにSetup実行ボタン追加

### 7. Command Bar（Cmd+K コマンドパレット）

- **現状**: 未実装
- **あるべき姿**: Cmd+Kでアクション検索・実行
- **仕様**: [07-core-features.md](./07-core-features.md) — コマンドバー セクション
- **実装TODO**:
  - `client/src/components/CommandBar/CommandBarDialog.tsx` 新規作成
  - アクション定義・可視性コンテキスト作成
  - Cmd+Kキーバインド登録

### 8. Scratch/Draft システム拡張

- **現状**: FollowUpInputのドラフト保存のみ
- **あるべき姿**: タスク作成ドラフト、UI設定の永続化
- **仕様**: [07-core-features.md](./07-core-features.md) — Scratch/Draftシステム セクション
- **実装TODO**:
  - `scratches` テーブル新規作成
  - タスク作成時のドラフト保存
  - UI設定（パネルサイズ、サイドバー状態）の永続化

### 9. Workspace Notes（フリーフォームメモ）

- **現状**: 未実装
- **あるべき姿**: タスクにフリーフォームのメモを紐付け
- **仕様**: [07-core-features.md](./07-core-features.md) — Workspace Notes セクション
- **実装TODO**:
  - `workspace_notes` テーブル新規作成
  - タスク詳細パネルにノートエリア追加

---

## 優先度分類

### 高（エージェント対話の基本UX改善）
1. **AskUserQuestion専用レンダリング** — 現状genericで見づらい、最も頻出するエージェントアクション
2. **Approval Timeout** — 承認が放置された場合のハンドリング
3. **Session Fork UI** — 既存バックエンドの活用、会話の柔軟な操作

### 中（機能追加）
4. **Code Review フロー** — エージェント活用の幅を広げる
5. **Script実行の体系化** — セットアップ体験の改善
6. **Dev Server統合** — 開発フロー全体のカバー

### 低（利便性向上）
7. **Command Bar** — アクションの発見性向上
8. **Scratch/Draftシステム拡張** — 入力のロスト防止
9. **Workspace Notes** — 補助的なメモ機能

---

## 検証方法
- 各機能ごとにユニットテスト追加（server: bun test, client: vitest）
- `bun run check:type` で型チェック通過
- 実際にClaude Codeエージェントを起動し、各アクションが正しくレンダリングされることを確認
- 特にAskUserQuestionは、エージェント実行中に質問が来た場合に専用カードが表示され、回答が送信できることをE2Eで確認
