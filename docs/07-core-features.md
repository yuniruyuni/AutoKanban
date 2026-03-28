# コア機能詳細

## 1. ワークスペース管理

### 概念

```
Project
  └── Task
        └── Workspace
              └── Session
                    └── ExecutionProcess
```

### ワークスペースのライフサイクル

```
1. 作成
   └── Gitワークツリー作成（各リポジトリに対して）
   └── ブランチ作成
   └── WorkspaceRepoレコード作成

2. セッション開始
   └── Sessionレコード作成
   └── セットアップスクリプト実行（ExecutionProcess: setupscript）
   └── エージェント実行（ExecutionProcess: codingagent）

3. 実行中
   └── ログストリーミング（tRPC Subscription）
   └── フォローアップメッセージ送信
   └── 開発サーバー起動（ExecutionProcess: devserver）

4. 完了/停止
   └── プロセス終了
   └── マージ/PR作成（オプション）

5. クリーンアップ
   └── クリーンアップスクリプト実行（ExecutionProcess: cleanupscript）
   └── ワークツリー削除
```

### Gitワークツリー

```bash
# ワークスペースディレクトリ構造
~/.auto-kanban/workspaces/
  └── {workspace-id}/
        ├── {repo-name-1}/    # ワークツリー1
        │     └── (repo contents)
        └── {repo-name-2}/    # ワークツリー2
              └── (repo contents)
```

### ブランチ命名規則

```
ak/{short-id}/{sanitized-task-title}
```

例: `ak/a1b2c3d4/fix-login-bug`

---

## 2. エージェント実行

### 対応エージェント

| ID | 名前 | 説明 |
|-----|------|------|
| `CLAUDE_CODE` | Claude Code | Anthropic Claude |
| `GEMINI` | Gemini CLI | Google Gemini |
| `CODEX` | Codex | OpenAI Codex |
| `AMP` | Amp | Sourcegraph |
| `CURSOR_AGENT` | Cursor | Cursor IDE |
| `COPILOT` | Copilot | GitHub Copilot |

### 実行フロー

```typescript
// 1. エージェント設定解決
const config = EXECUTOR_CONFIGS[executor];

// 2. MCP設定注入（必要な場合）
if (mcpConfig) {
  await writeMcpConfig(workingDir, mcpConfig);
}

// 3. プロセス起動
const proc = spawn({
  cmd: [config.command, ...config.args, prompt],
  cwd: workingDir,
  stdout: 'pipe',
  stderr: 'pipe',
  stdin: 'pipe',
});

// 4. ログ収集・配信
streamOutput(executionProcessId, proc);

// 5. 終了監視
proc.exited.then((exitCode) => {
  updateProcessStatus(executionProcessId, exitCode);
});
```

### MCP設定

```json
{
  "mcpServers": {
    "server-name": {
      "command": "path/to/server",
      "args": ["--arg1", "value"],
      "env": {
        "API_KEY": "..."
      }
    }
  }
}
```

エージェント実行時に設定ファイルとして注入。

---

## 3. リアルタイム通信

### tRPC Subscriptions

WebSocketを使用したリアルタイム更新。

```typescript
// バックエンド: Subscription定義
onLog: publicProcedure
  .input(z.object({ id: z.string() }))
  .subscription(({ input }) => {
    return observable<string>((emit) => {
      const onLogChunk = (chunk: string) => {
        emit.next(chunk);
      };

      logStreams.on(input.id, onLogChunk);

      return () => {
        logStreams.off(input.id, onLogChunk);
      };
    });
  }),

// フロントエンド: Subscription使用
trpc.executionProcess.onLog.useSubscription(
  { id: executionProcessId },
  {
    onData: (chunk) => {
      setLogs((prev) => prev + chunk);
    },
  }
);
```

### EventEmitter パターン

```typescript
// server/src/repositories/event-repository.ts
class EventRepository {
  private emitter = new EventEmitter();

  // タスクイベント
  emitTaskEvent(event: TaskEvent): void {
    this.emitter.emit('task', event);
  }

  onTaskEvent(callback: (event: TaskEvent) => void): () => void {
    this.emitter.on('task', callback);
    return () => this.emitter.off('task', callback);
  }

  // ログイベント
  emitLogEvent(event: LogEvent): void {
    this.emitter.emit(`log:${event.executionProcessId}`, event.chunk);
  }
}
```

---

## 4. Git統合

### GitRepository

```typescript
// server/src/repositories/git-repository.ts
import { $ } from 'bun';

export class GitRepository {
  // ワークツリー作成
  async createWorktree(options: {
    repoPath: string;
    worktreePath: string;
    branch: string;
    baseBranch?: string;
  }): Promise<void> {
    const { repoPath, worktreePath, branch, baseBranch = 'main' } = options;

    await $`git -C ${repoPath} branch ${branch} ${baseBranch}`.quiet();
    await $`git -C ${repoPath} worktree add ${worktreePath} ${branch}`.quiet();
  }

  // ワークツリー削除
  async removeWorktree(options: {
    repoPath: string;
    worktreePath: string;
    branch: string;
  }): Promise<void> {
    await $`git -C ${repoPath} worktree remove ${worktreePath} --force`.quiet();
    await $`git -C ${repoPath} branch -D ${branch}`.quiet();
  }

  // 差分取得
  async diff(repoPath: string, from: string, to: string = 'HEAD'): Promise<string> {
    return await $`git -C ${repoPath} diff ${from}..${to}`.text();
  }

  // マージ
  async merge(repoPath: string, branch: string): Promise<{ success: boolean; mergeCommit?: string }> {
    try {
      await $`git -C ${repoPath} merge ${branch}`.quiet();
      const mergeCommit = await this.headCommit(repoPath);
      return { success: true, mergeCommit };
    } catch {
      return { success: false };
    }
  }
}
```

### Git リポジトリ初期化（initGitRepo）

プロジェクト作成画面で非Gitディレクトリを選択した場合、「Initialize Git」ボタンでリポジトリを初期化できる。

**実行手順:**

1. `git init -b main` — mainブランチ指定でリポジトリ初期化
2. `git commit --allow-empty -m 'initial commit'` — 空コミットでmainブランチを確立
3. `git add -A` → ステージされたファイルがあれば `git commit -m 'Add existing files'` — 既存ファイルをコミット

**設計意図:**

- `git init` 直後はブランチが存在しない（HEADが未解決）ため、ワークツリー作成等の後続操作が失敗する。空コミットで確実にブランチを作成する
- 既存ファイルがある場合は2つ目のコミットで記録し、空ディレクトリの場合はスキップする
- `git diff --cached --quiet` でステージ済みファイルの有無を判定

**Usecase:** `server/src/usecases/project/init-git-repo.ts`

---

### マルチリポジトリ対応

```
workspace_repos テーブル
  └── workspace_id
  └── repo_id
  └── target_branch  # マージ先ブランチ
```

---

## 5. 設定管理

### 設定ファイル

```typescript
// ~/.auto-kanban/config.json
interface Config {
  version: number;
  mcp?: {
    mcpServers?: Record<string, {
      command: string;
      args?: string[];
      env?: Record<string, string>;
    }>;
  };
  executors?: Record<string, {
    enabled: boolean;
    variant?: string;
  }>;
}
```

### 読み書き

```typescript
// server/src/repositories/config-repository.ts
const CONFIG_PATH = join(homedir(), '.auto-kanban', 'config.json');

export async function readConfig(): Promise<Config> {
  try {
    const file = Bun.file(CONFIG_PATH);
    if (await file.exists()) {
      return await file.json();
    }
  } catch {
    // ファイルが存在しないか読み取りエラー
  }
  return DEFAULT_CONFIG;
}

export async function writeConfig(config: Config): Promise<void> {
  await Bun.write(CONFIG_PATH, JSON.stringify(config, null, 2));
}
```

---

## 6. タスク管理

### ステータス遷移

タスクの状態遷移の詳細は [15-task-state-transitions.md](./15-task-state-transitions.md) を参照。

すべての状態間の遷移が許可される。遷移時の副作用（Agent Stop, Chat Reset等）と確認ダイアログの表示がアプリケーション層の責務となる。

### ステータスの意味

| ステータス | 説明 |
|-----------|------|
| `todo` | 未着手。エージェントがまだ起動されていない |
| `inprogress` | 作業中。エージェントが稼働中 |
| `inreview` | レビュー待ち。エージェント完了後、ユーザーがChangesを確認する段階。追加チャット指示でinprogressに戻る |
| `done` | 完了。マージ済み |
| `cancelled` | キャンセル |

---

## 7. プロセス管理

### ExecutionProcess の種類

| run_reason | 説明 |
|------------|------|
| `setupscript` | セットアップスクリプト（依存インストール等） |
| `codingagent` | AIコーディングエージェント |
| `devserver` | 開発サーバー |
| `cleanupscript` | クリーンアップスクリプト |

### プロセスの状態

| status | 説明 |
|--------|------|
| `running` | 実行中 |
| `completed` | 正常終了（exit code 0） |
| `failed` | 異常終了（exit code != 0） |
| `killed` | 強制終了（SIGTERM/SIGKILL） |

### ログ管理

```typescript
// ログ追記
async appendLog(executionProcessId: string, chunk: string): Promise<void> {
  const existing = await db.query.executionProcessLogs.findFirst({
    where: eq(executionProcessLogs.executionProcessId, executionProcessId),
  });

  if (existing) {
    await db.update(executionProcessLogs)
      .set({ logs: existing.logs + chunk })
      .where(eq(executionProcessLogs.executionProcessId, executionProcessId));
  } else {
    await db.insert(executionProcessLogs).values({
      executionProcessId,
      logs: chunk,
    });
  }
}
```

---

## 8. セットアップ/クリーンアップスクリプト

### 設定

```typescript
// project_repos テーブル
{
  projectId: string;
  repoId: string;
  setupScript: string | null;     // npm install など
  cleanupScript: string | null;   // rm -rf node_modules など
  devServerScript: string | null; // npm run dev など
}
```

### 実行

```typescript
// セットアップスクリプト実行
async function runSetupScript(workspaceDir: string, script: string): Promise<void> {
  const proc = spawn({
    cmd: ['sh', '-c', script],
    cwd: workspaceDir,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  // ログ収集
  for await (const chunk of proc.stdout) {
    appendLog(executionProcessId, new TextDecoder().decode(chunk));
  }

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`Setup script failed with exit code ${exitCode}`);
  }
}
```

---

## 9. 開発サーバー

### 起動

```typescript
// 開発サーバー起動
async function startDevServer(workspaceId: string, script: string): Promise<void> {
  const executionProcessId = createId();

  await db.insert(executionProcesses).values({
    id: executionProcessId,
    sessionId,
    runReason: 'devserver',
    status: 'running',
  });

  const proc = spawn({
    cmd: ['sh', '-c', script],
    cwd: workspaceDir,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  devServerProcesses.set(workspaceId, { proc, executionProcessId });

  // ログストリーミング
  streamOutput(executionProcessId, proc);
}
```

### 停止

```typescript
async function stopDevServer(workspaceId: string): Promise<void> {
  const server = devServerProcesses.get(workspaceId);
  if (server) {
    server.proc.kill('SIGTERM');
    devServerProcesses.delete(workspaceId);
  }
}
```

---

## 10. データの流れ

### タスク作成からエージェント実行まで

```
1. ユーザーがタスク作成
   └── trpc.task.create.mutate({ projectId, title, description })
   └── DBにtask挿入

2. ワークスペース開始
   └── trpc.workspace.create.mutate({ taskId, executor, repos })
   └── Gitワークツリー作成
   └── DBにworkspace, workspace_repos挿入

3. セッション開始
   └── DBにsession挿入
   └── セットアップスクリプト実行（execution_process: setupscript）
   └── 完了待ち

4. エージェント実行
   └── DBにexecution_process挿入（run_reason: codingagent）
   └── プロセス起動
   └── ログをDB保存 + リアルタイム配信

5. 完了
   └── プロセス終了監視
   └── execution_process.status更新
   └── task.status更新（オプション）
```

---

## 11. 外部ツール

### 概念

外部ツール（VSCode、Terminal等）をSettings画面から登録し、タスクカードやタスク詳細画面からワンクリックで起動できる機能。ツールのコマンドには `{path}` プレースホルダを含めることができ、実行時にワークスペースディレクトリパスに置換される。

### データモデル

```sql
-- tools テーブル
CREATE TABLE tools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,          -- 表示名（例: "VS Code"）
  icon TEXT NOT NULL,          -- lucide-react アイコン名（例: "Code", "Terminal"）
  icon_color TEXT NOT NULL DEFAULT '#71717A',
  command TEXT NOT NULL,       -- 実行コマンド（例: "code {path}"）
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### Settings画面での登録・管理

Settings > Tools 画面でCRUD操作が可能。各ツールに名前、アイコン、コマンドを設定する。

### タスク画面での呼び出し

| 画面 | 表示位置 | 表示条件 |
|------|----------|----------|
| TaskCard（カンバンカード） | メタ行右端 | ツール登録時のみ表示 |
| TaskDetailPanel（サイドパネル） | ヘッダー右端 | ツール登録時のみ表示 |
| TaskDetailFullscreen（フルスクリーン） | ヘッダー右端 | ツール登録時のみ表示 |

ツールボタンはサーバーから取得した `toolStore` のツールリストから動的に生成される。アイコンは `getIconComponent()` で lucide-react コンポーネントに変換される。

### 実行フロー

```typescript
// 1. クライアント: ボタンクリック
const executeTool = trpc.tool.execute.useMutation();
await executeTool.mutateAsync({ toolId, taskId });

// 2. サーバー: コマンド実行
//    - toolId からツールレコード取得
//    - taskId からワークスペースパス解決
//    - command 内の {path} をワークスペースパスに置換
//    - spawn でコマンド実行
```

---

## 12. コードレビューフロー

### 概要

エージェントの作業完了後、コードレビューを依頼するフロー。エージェントに差分をレビューさせ、問題点の指摘や改善提案を受ける。

### フロー

```
1. エージェント作業完了
   └── NextActionCardに "Start Review" ボタン表示

2. ユーザーが "Start Review" クリック
   └── StartReviewDialog表示
   └── レビュー指示（オプション）を入力

3. レビュー実行
   └── start-review usecase呼び出し
   └── エージェントに差分 + レビュー指示を送信
   └── レビュー結果をチャットに表示

4. レビュー完了
   └── 指摘事項を修正 or マージへ進む
```

### データ構造

```typescript
type ReviewRequest = {
  taskId: string;
  instructions?: string;  // レビュー時の追加指示
};
```

### StartReviewDialog

- **ヘッダー**: "Start Code Review"
- **入力欄**: レビュー指示テキストエリア（オプション、プレースホルダー: "Focus on..."）
- **差分プレビュー**: 変更ファイル一覧を表示
- **ボタン**: Cancel / Start Review

---

## 13. Dev Server統合

### 概要

ワークスペース内の開発サーバーの起動・停止をチャットUIから制御し、プレビューモードを自動表示する。

### 制御フロー

```
1. NextActionCard / ChatHeaderに "Dev Server" ボタン表示

2. 起動
   └── project_repos.dev_server_script を使用
   └── ExecutionProcess (run_reason: 'devserver') として管理
   └── ログはリアルタイムストリーミング

3. 停止
   └── SIGTERM送信
   └── ExecutionProcess status更新
```

### クライアント側

```typescript
// client/src/hooks/useDevServer.ts
interface DevServerState {
  isRunning: boolean;
  url?: string;        // 検出されたローカルURL
  processId?: string;
}
```

- **ステータス表示**: ChatHeaderに開発サーバーの稼働状態をインジケーター表示
- **プレビュー**: 開発サーバーURL検出時にプレビューモードを自動提案

---

## 14. コマンドバー（Cmd+K）

### 概要

`Cmd+K`（macOS）/ `Ctrl+K`（Windows/Linux）で起動するコマンドパレット。アプリ全体のアクションを検索・実行可能。

### コンポーネント

```
CommandBarDialog
├── 検索入力欄（フィルタリング）
├── アクションリスト
│   ├── タスク操作（作成、ステータス変更、削除）
│   ├── ビュー切替（カンバン、リスト、フルスクリーン）
│   ├── Git操作（マージ、ブランチ切替、差分表示）
│   ├── エージェント操作（起動、停止、レビュー依頼）
│   └── 設定（テーマ切替、設定画面を開く）
└── キーボードナビゲーション（↑↓選択、Enter実行、Esc閉じる）
```

### アクション可視性

```typescript
// ActionVisibilityContext
interface ActionVisibility {
  id: string;
  label: string;
  icon: string;
  shortcut?: string;
  visible: boolean;    // 現在のコンテキストで表示するか
  enabled: boolean;    // 実行可能か
  execute: () => void;
}
```

- コンテキスト依存: 選択中のタスク、エージェント稼働状態により可視性・有効状態が変化
- ショートカット表示: 各アクションの横にキーボードショートカットを表示

---

## 15. Scratch/Draftシステム

### 概要

ユーザーの入力途中データを永続化し、ブラウザリロードや画面遷移によるデータロストを防止する。

### スクラッチ種別

| 種別 | 説明 | 保存タイミング |
|------|------|--------------|
| `DraftTask` | タスク作成フォームの入力途中データ | フォーム入力時に自動保存 |
| `DraftFollowUp` | フォローアップ入力の下書き（既存） | 入力時に自動保存 |
| `UiPreferences` | パネルサイズ、サイドバー状態等 | 変更時に自動保存 |

### データ構造

```sql
CREATE TABLE IF NOT EXISTS scratches (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  scope_id TEXT,          -- タスクIDやプロジェクトID等
  data TEXT NOT NULL,     -- JSON文字列
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

---

## 16. Workspace Notes（フリーフォームメモ）

### 概要

タスクやワークスペースにフリーフォームのメモを紐付けできる機能。エージェントへの指示メモ、作業メモ、備忘録等を記録する。

### UI

- **配置**: タスク詳細パネル内にノートタブ/セクション追加
- **エディタ**: プレーンテキストエリア（Markdown対応、将来的にリッチエディタ）
- **自動保存**: 入力中にデバウンスで自動保存

### データ構造

```sql
CREATE TABLE IF NOT EXISTS workspace_notes (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  content TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```
