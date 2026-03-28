# チャットインターフェイス仕様

## 概要

チャットUIは、Claude Codeエージェントとの対話をリアルタイムで表示するインターフェイスである。Claude Codeのストリームプロトコル（`stream-json`形式）の出力をパースし、構造化されたエントリとして描画する。

### Claude Codeプロトコルモード

Claude Codeは以下の権限モードで動作する:

| モード | 説明 | デフォルト |
|--------|------|-----------|
| `bypassPermissions` | 全ツール自動承認 | **有効** |
| `default` | 危険な操作に承認要求 | - |
| `acceptEdits` | ファイル編集は自動承認、その他は要求 | - |
| `plan` | 全ツール要承認 | - |

デフォルトは`bypassPermissions`を維持し、設定UIから切り替え可能とする。

---

## エントリタイプ一覧

チャットUIに表示される全エントリ種別:

| kind | 説明 | コンポーネント |
|------|------|--------------|
| `user_message` | ユーザー入力テキスト | `UserMessage` |
| `assistant_message` | Claudeの応答テキスト（Markdown） | `AssistantMessage` |
| `thinking` | Claudeの思考プロセス | `ThinkingMessage` |
| `tool` | ツール実行（ファイル操作、コマンド等） | `ToolEntryComponent` |
| `system_message` | システム通知 | `SystemMessage` |
| `error` | エラー表示 | `ErrorMessage` |
| `user_feedback` | ツール拒否時のユーザーフィードバック | `UserFeedbackEntry` |
| `token_usage` | トークン使用量情報 | `TokenUsageBar` |
| `loading` | ローディングスケルトン | `LoadingEntry` |

### ToolAction種別

| type | ツール名 | 表示内容 |
|------|---------|---------|
| `file_read` | `Read` | ファイルパス |
| `file_edit` | `Edit` | パス + インラインDiff |
| `file_write` | `Write` | ファイルパス |
| `command` | `Bash` | コマンド文字列 + 終了コード |
| `search` | `Grep`/`Glob` | パターン + パス |
| `web_fetch` | `WebFetch`/`WebSearch` | URL |
| `task` | `Task` | エージェント種別 + 説明 |
| `plan` | `ExitPlanMode` | プラン内容表示（承認/拒否はPlanResponseInputで行う） |
| `todo_management` | `TodoWrite` | TodoCard（折り畳み式、デフォルト閉、進捗バッジ付き） |
| `ask_user` | `AskUserQuestion` | 質問テキスト + 回答入力UI |
| `generic` | その他 | JSON表示 |

---

## ツール承認/権限システム

### ToolStatus

```typescript
type ToolStatus =
  | 'running'           // 実行中
  | 'success'           // 成功
  | 'failed'            // 失敗
  | 'pending_approval'  // 承認待ち
  | 'denied'            // 拒否済み
  | 'timed_out'         // タイムアウト（承認期限切れ）
  | 'pending_answer';   // 回答待ち（AskUserQuestion）
```

### バックエンド承認ストア（ApprovalStore）

Permission承認とPlan承認の両方を統一的に管理するバックエンド機構。

#### approvalsテーブル（DB永続化）

```sql
CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  execution_process_id TEXT NOT NULL REFERENCES execution_processes(id),
  tool_name TEXT NOT NULL,
  tool_call_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'approved', 'denied', 'timed_out')),
  reason TEXT,
  timeout_at TEXT,
  created_at TEXT NOT NULL,
  responded_at TEXT,
  updated_at TEXT NOT NULL
);
```

- `Approval.Status`: `pending` | `approved` | `denied` | `timed_out`
- タイムアウト: `timeout_at`カラムで承認期限を管理（デフォルト: 作成から5分後）
- タイムアウト検出: サーバー側で定期チェック、またはクライアント側でカウントダウン表示＋タイムアウト検出
- タイムアウト時: `status`を`timed_out`に更新、エージェントに拒否応答を返す
- サーバー再起動耐性: DB永続化により、再起動後も`--resume`で自動再開し、DB上の承認応答を参照して自動応答
- タスクステータス遷移: 承認リクエスト作成時に`inprogress` → `inreview`、応答時に`inreview` → `inprogress`

#### ApprovalStore（インメモリブリッジ）

DBとエージェントプロセスの橋渡し。Promise-basedで承認待機:
- `createAndWait(approval)`: DBに永続化 + Promiseで応答を待機
- `respond(id, status, reason)`: DB更新 + Promise resolve
- `hasPending(executionProcessId)`: pending承認の有無確認

### Permission承認フロー

1. Claude Codeが`control_request`（`permission_request`サブタイプ）を送信
2. サーバーのPermission Storeに登録、対応するToolEntryのstatusを`pending_approval`に更新
3. クライアントにチャット内`ApprovalCard`を表示（ツール名のみ、タイマーなし）
4. チャット入力欄が`PermissionResponseInput`に置き換わる
5. Subagent並列実行時は複数のPermissionが同時にpendingになる（pending件数バッジ表示）
6. ユーザーがApprove/Denyを選択（キーボード: `y`/`n`、または一括承認）
7. サーバー経由で`control_response`を送信
8. ToolEntryのstatusを`success`/`denied`に更新
9. 全pending処理完了後、チャット入力欄が通常状態に戻る

### Plan承認フロー

1. Claude Codeが`ExitPlanMode`ツールを呼び出し
2. バックエンドがExitPlanModeの`permission_request`を検出し、ApprovalStoreにDB登録（`status: 'pending'`）
3. タスクステータスを`inprogress` → `inreview`に変更
4. エージェントプロセスがApprovalStore.createAndWait()でPromise awaitブロック
5. チャット内に`PlanCard`を表示（プラン内容リスト、ボタンなし）
6. チャット入力欄が`PlanResponseInput`に置き換わる
7. ユーザーがApprove/Rejectを選択（オプションでフィードバックテキストを添付可能）
8. サーバーがApprovalStore.respond()で応答 → DB更新 + `sendPermissionResponse()`でエージェントに返す
9. タスクステータスを`inreview` → `inprogress`に戻す
10. 応答後、チャット入力欄が通常状態に戻る
11. サーバー再起動時: `--resume`で自動再開、再リクエスト時にDBの回答を即返し

### AskUserQuestion専用カード

エージェントが`AskUserQuestion`ツールを呼び出した際に表示される専用UIカード。

#### AskUserCard仕様

- **表示**: 質問アイコン（`HelpCircle`）+ エージェントからの質問テキスト
- **ボーダー**: 青（`#3B82F6`）— 情報要求であることを視覚的に示す
- **状態**: `pending`（回答待ち）/ `answered`（回答済み）
- **pending時**: カード下部に質問の重要度を示す青いパルスインジケーター

#### AskUserResponseInput

AskUserQuestion発生時に通常のチャット入力欄を置き換えるコンポーネント。

- **ヘッダー**: `HelpCircle`アイコン + "Agent is asking a question"
- **質問プレビュー**: エージェントの質問テキストを表示（長文は折り畳み）
- **入力欄**: テキストエリア（回答入力用、プレースホルダー: "Type your answer..."）
- **ボタン**:
  - Send Answer（Enter / Cmd+Enter）: 回答を送信
- **回答送信後**: 通常のチャット入力欄に戻る
- **実装**: `PermissionResponseInput`と同様のパターンで、チャット入力の表示状態を管理

---

### ApprovalCard仕様

- ツール名を表示（ボタン・タイマーは含まない）
- 状態別カラー: pending(オレンジ), approved(緑), denied(赤)
- 承認/拒否の操作はカード内ではなく、チャット入力欄を置き換える`PermissionResponseInput`で行う

### PermissionResponseInput

Permission承認要求が発生した際、通常のチャット入力欄を置き換えて表示されるコンポーネント。

- ヘッダー: シールドアイコン + "Permission required" + pending件数バッジ + タイムアウトカウントダウン
- 現在のPermission詳細: ツールアイコン + ツール名 + コマンド
- タイムアウト表示: 残り時間をカウントダウン表示（残り30秒未満で赤色警告）
- ボタン:
  - Deny (N): 赤枠、現在のPermissionを拒否
  - Approve (Y): 緑塗り、現在のPermissionを承認
  - Approve All: 緑枠、全pending Permissionを一括承認
- Subagentによる並列実行時、複数のPermissionが同時にpendingになる場合がある
- 1件承認/拒否すると次のpending Permissionに自動遷移
- 全件処理完了後、通常のチャット入力欄に戻る

### PlanCard仕様

- プランアイコン + タイトル + プラン内容リストを表示（ボタンは含まない）
- 承認/拒否の操作はカード内ではなく、チャット入力欄を置き換える`PlanResponseInput`で行う
- ボーダーカラー: オレンジ（#F59E0B）

### PlanResponseInput

Plan承認要求が発生した際、通常のチャット入力欄を置き換えて表示されるコンポーネント。

- ヘッダー: クリップボードアイコン + "Plan requires your response"
- フィードバック入力欄: オプションのテキストエリア（フィードバックや追加指示を記入可能）
- ボタン:
  - Reject: 赤枠、フィードバックと共にAgentに差し戻し
  - Approve: 緑塗り、プランを承認して実行続行
- Plan承認は一度に1件のみ（Permission承認と異なり複数同時にはならない）

### UserFeedbackEntry

ツール拒否時にユーザーが入力した理由テキストを表示するエントリ。拒否理由がある場合のみ生成される。

---

## エントリ集約

連続する同種のToolEntryをアコーディオンに折り畳み、UIの視認性を向上させる。

### 集約ルール

| パターン | ラベル例 |
|---------|---------|
| 連続 `file_read` | "Read N files" |
| 連続 `search` | "Searched N patterns" |
| 連続 `web_fetch` | "Fetched N URLs" |
| 同一パスへの連続 `file_edit` | "Edited {path} (N changes)" |
| 連続 `todo_management` | "Updated Todos (N updates)" |

### 実装

`aggregateEntries(entries)` 純粋関数でエントリ配列を走査し、連続する同種エントリを`AggregatedGroup`に変換:

```typescript
interface AggregatedGroup {
  kind: 'group';
  actionType: string;
  entries: ConversationEntry[];
  label: string;
}
```

展開時は個別のToolEntryComponentをそのまま表示する。

---

## ローディング状態

エージェント処理中（`isRunning && !isIdle`）のUI:

- AssistantMessageの形状に合わせたスケルトンアニメーション
- 左にアバター丸（グレー）、右にテキスト行3-4本（`animate-pulse`）
- `Loader2`アイコン + "Processing..."テキストは廃止

---

## トークン使用量表示

Claude Codeの`result`メッセージに含まれる`usage`データを抽出してヘッダーに表示。

### TokenUsageBar仕様

- 水平ゲージバー（プログレスバー形式）
- 色: 緑(<50%) / 黄(50-80%) / 赤(>80%)
- ホバーで詳細数値をツールチップ表示（input/output/total tokens）
- `ExecutionPanel`のヘッダーに配置

### データ構造

```typescript
interface TokenUsageEntry {
  kind: 'token_usage';
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  contextWindow: number;
}
```

---

## フォローアップ入力

### 基本仕様

- `FollowUpInput`コンポーネントで`Cmd/Ctrl + Enter`送信
- エージェントがビジー時はメッセージをキューに保存（オレンジ"Queued:"表示）
- キュー中のメッセージはキャンセル可能
- バリアント選択: Default / Plan mode

### 画像添付（将来）

- クリップボードからのペーストサポート
- ファイル添付ボタン
- 添付画像のサムネイルプレビュー

---

## メッセージ編集/リトライ（Session Fork）

### 会話フォーク

ユーザーメッセージを編集して会話を分岐させる機能。既存の`forkConversation`バックエンドエンドポイントを活用。

#### UserMessage UI

- ユーザーメッセージにホバーで編集アイコン（`Pencil`）表示
- クリックでインライン編集モード（`RetryEditor`）に切替
- 編集中: テキストエリア + "Cancel" / "Retry" ボタン
- 編集確定で、その時点から新しいプロンプトで会話を再開

#### RetryEditor コンポーネント

- **表示**: ユーザーメッセージをテキストエリアに展開（元のテキストがプリセット）
- **ボタン**:
  - Cancel: 編集モードを解除、元のメッセージに戻る
  - Retry（Cmd+Enter）: 編集内容で`forkConversation`を呼び出し
- **フォーク実行後**: 新しい会話ストリームに切替、フォーク以降のエントリを差し替え

#### サーバー連携

- サーバー側: `--resume` + `--resume-session-at`を使用して指定時点まで巻き戻し
- `forkConversation`エンドポイント（既存）を使用

### データ構造

`ConversationEntry`に`messageUuid?: string`を追加し、フォークポイントを特定。

---

## スクロール動作

### 3つのモード

| モード | 条件 | 動作 |
|--------|------|------|
| Initial | `entries.length === 0` | スクロール不要 |
| Running | `isRunning` | 新エントリ追加時にボトムまで自動スクロール（ユーザーが下部にいる場合のみ） |
| Plan Review | ExitPlanMode表示中 | 自動スクロール停止、PlanCardまでスクロール |

### 実装

`IntersectionObserver`でボトムマーカーの可視性を追跡。ユーザーがスクロールアップした場合は自動スクロールを停止。

---

## インラインDiff表示

### 仕様

- `file_edit`アクションのToolEntry内にunified diff形式で表示
- `@git-diff-view/react`ライブラリを使用
- 折り畳み/展開トグル
- +/-N行の統計表示
- 短い変更（3行未満）は従来の簡易表示（赤/緑ブロック）を維持

---

## コマンド実行結果

### 終了コード表示

- `ToolResult`に`exitCode?: number`フィールド追加
- Bashツールの結果から終了コードをパース
- ToolEntryヘッダーに表示:
  - 終了コード0: 緑のステータスドット
  - 終了コード非0: 赤のステータスドット + コード番号表示

---

## Todo管理表示

### TodoCard — TodoWriteツールの専用カード

TodoWriteは専用`TodoCard`コンポーネントで表示する（`PlanCard`/`ApprovalCard`と同様のパターン）。

- **デフォルト折り畳み**: TodoWriteは頻繁に呼び出されるため、デフォルトは閉じた状態
- **ヘッダー**: `ListChecks`アイコン（紫）+ "Updated Todos" + 進捗バッジ（`completed/total`、紫背景）+ Chevron
- **展開時**: チェックリスト表示（ステータスアイコン＋content＋description）
  - `pending`: 空の丸アイコン（`Circle`、`text-text-muted`）
  - `in_progress`: 半分塗りの丸アイコン（`CircleDot`、`text-accent`）
  - `completed`: チェック付きの丸アイコン（`CheckCircle2`、`text-success`）
- **集約**: 連続TodoWrite呼び出しはentry-aggregatorで集約（"Updated Todos (N updates)"）
- **スタイル**: `ml-9 rounded-lg border border-border bg-secondary`（PlanCard/ApprovalCardと同じインデント）

### TodoProgressPopup — ヘッダー常時表示の進捗ポップアップ

チャットヘッダー右側（Stopボタンの左）に配置される、全todoの進捗を常時確認できるポップアップ。

- **データソース**: `useTodoProgress`フックで`currentEntries`から最新の`todo_management`エントリを抽出
- **空状態**: `ListChecks`アイコンをdisabled表示（`opacity-40`、`cursor-not-allowed`）
- **通常状態**: `ListChecks`アイコン＋進捗ドット（未完了: accent色、全完了: success色）
- **クリック**: ポップオーバーを開閉（`useState`トグル＋外側クリックで閉じる）
- **ポップオーバー内容**:
  - ヘッダー: "Tasks" + `completed/total completed`
  - プログレスバー: `h-1.5`、未完了=accent色、完了=success色
  - todoリスト: StatusIcon＋content（TodoCardと同じアイコンロジック）
  - `max-h-60 overflow-y-auto`でスクロール可能
- **外部ライブラリ不使用**: `useState` + `useRef` + `useEffect`（outsideクリック検知）で実装

---

## Next Actionカード

### 仕様

会話終了時（`!isRunning && entries.length > 0`）に表示:

- **Diff統計サマリー**: 変更ファイル数、+追加行数、-削除行数
- **アクションボタン**:
  - "Try Again" — 最後のプロンプトを再実行
  - "Open Diffs" — DiffPanelタブに切替
  - "Start Agent" — 新しいエージェント起動
  - "Start Review" — コードレビューフローを開始（StartReviewDialog表示）
  - "Run Setup" — セットアップスクリプトを実行
  - "Dev Server" — 開発サーバーの起動/停止制御

---

## リアルタイム更新

### SSEストリーミング（実装済み）

構造化ログのリアルタイム配信にSSE（Server-Sent Events）を使用。

- **サーバーエンドポイント**: `/sse/structured-logs/:id`, `/sse/logs/:id`（Hono `streamSSE`）
- **クライアント**: `useStructuredLogStream` フックが `EventSource` で接続
- **イベント種別**:
  - `snapshot`: 初回接続時の全エントリスナップショット
  - `entry_add`: 新エントリ追加
  - `entry_update`: 既存エントリ更新（ToolStatusの変化等）
  - `idle_changed`: アイドル状態の変化

### 会話履歴

会話履歴（`getConversationHistory`）はtRPCポーリングで取得。ライブストリーミングとは別経路。

### 仮想化（将来）

- `@tanstack/react-virtual`の`useVirtualizer`でリスト仮想化
- 動的行高さ計測
- 大量のエントリでもスムーズなスクロール
