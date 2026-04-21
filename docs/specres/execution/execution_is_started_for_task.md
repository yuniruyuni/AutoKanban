---
id: "01KPNSJ3QGNXV9410M3DFH802A"
name: "execution_is_started_for_task"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/usecases/execution/start-execution.ts`
- `server/src/usecases/execution/start-execution.test.ts` (Test)
- `server/src/presentation/trpc/routers/execution.ts` (`start` procedure)
- `server/src/models/workspace/index.ts` (`determineAttemptStrategy`)
- `server/src/models/session/index.ts`
- `server/src/models/coding-agent-process/index.ts`
- `server/src/models/coding-agent-turn/index.ts`
- `server/src/repositories/executor/`
- `server/src/repositories/worktree/`
- `server/src/repositories/script-runner/`
- `client/src/components/chat/StartAgentDialog.tsx`

## 機能概要

タスクに紐づく Coding Agent を新規に起動する。`Task → Workspace → Session → CodingAgentProcess →
CodingAgentTurn` のチェーンを DB に構築し、Git worktree を確保して（必要なら prepare スクリプトを実行）
Executor サブプロセスを protocol mode で spawn する。同じタスクで再起動された場合は、
`Workspace.determineAttemptStrategy` が「新 attempt を作るか既存 workspace を再利用するか」を決める。

## 概念的背景: なぜ 5 段のチェーンなのか

エージェント 1 回の起動に 5 つのエンティティが絡むのは複雑に見えるが、それぞれが異なる
関心事を担っており、階層を潰すと必ずどこかで情報を失う。

| 段 | 何を表すか | なぜ必要か |
|---|---|---|
| **Task** | 「やらせたいこと」（人間の意図） | カンバンに載る単位。ステータスで状態遷移を持つ |
| **Workspace** | 1 試行の物理環境（worktree + ブランチ） | 試行ごとに独立させるため。archive で履歴保持 |
| **Session** | 1 workspace 内の実行意図のまとまり | Stop→Resume、executor 切替、fork で切れ目を作る |
| **CodingAgentProcess** | 実際に spawn した 1 本の Executor プロセス | プロセス死亡 / resume が頻繁にあり、個別管理が必要 |
| **CodingAgentTurn** | Claude Code の会話識別子（resume 用） | `agentSessionId` / `agentMessageId` を保全して後続から続ける |

`startExecution` は**この 5 段を一貫して構築する唯一のエントリポイント**で、
ここを通らずに「途中の段だけ作る」経路は存在しない（設計ルール）。

## 設計意図

- **attempt 戦略**: active workspace に**セッションがまだ無い**なら再利用（resume 可能）、
  あれば新 attempt を作って前の workspace は `archived: true` に落とす。
  「一度でも実行された履歴は捨てない」という不可逆性ルールの実装
- **prompt は常に task から再生成**: `taskToPrompt(task)` が `title + description` を結合する。
  入力 `prompt` は（あるが）initial prompt としては使われない。
  なぜ再生成にしたか: タスク説明の**最新版**を常に AI に渡したい（途中でユーザーが詳細を
  書き足した場合も反映したい）。入力 `prompt` は将来のバリエーション用のフック
- **worktree / prepare スクリプトは post ステップ**: write ステップで DB 書き込みを先にコミットし、
  その後 External I/O（worktree 作成 → prepare 実行 → executor 起動）を行う。
  これは `.claude/rules/server-patterns.md` の「External I/O は post でのみ」に従っている。
  トランザクション停滞を避けつつ、DB 整合性は write までで閉じさせる
- **interrupted Task tool の回復**: resume 時に前セッションで途中状態だった Task tool を検出し、
  synthetic な error result を注入する。なぜ: Claude Code は tool use → tool result の対で
  会話が進むため、前プロセスが tool result を返す前に死ぬと次プロセスが延々 tool response 待ちに
  なる。人工的に "error" を注入して Claude に「そのツール呼び出しは失敗した、続けてよい」と
  伝えることで stuck を解消する

## 主要メンバー

- `taskId: string`
- `executor?: string` — 既定 `"claude-code"`
- `variant?: string` — 既定なし。Variant を引くと `permissionMode` / `model` / `appendPrompt` が採用
- `workingDir?: string` — 省略時は worktree パス
- `targetBranch?: string` — worktree の起点ブランチ。省略時は `project.branch`（通常 `main`）

## シナリオ

### 起動成功（初回 attempt）

1. `trpc.execution.start({ taskId, executor, variant, targetBranch })`
2. `read` で task / project / 既存 workspace / maxAttempt / resumeInfo / variantEntity /
   agentSettingEntity を収集
3. `process` で `determineAttemptStrategy` により新 workspace、新 session、
   新 CodingAgentProcess、新 CodingAgentTurn を構築
4. `write` で全エンティティを upsert、`task.status = "inprogress"` に更新
5. `post` で `worktree.ensureWorktreeExists` → workspace の `worktreePath` 更新用に updatedWorkspace を作る
6. `post` で `workspace.auto-kanban.json` の `prepare` があれば `scriptRunner.run` で実行
7. `post` で `executor.startProtocol({ ... })` によりサブプロセス起動
8. `finish` で updatedWorkspace / prepareScriptProcess / logs を DB に書く
9. `{ workspaceId, sessionId, executionProcessId, worktreePath }` を返却

### killed session からの再開

1. active workspace があり session が無い → 既存 workspace を再利用
2. `codingAgentTurn.findLatestResumeInfoByWorkspaceId` で `agentSessionId` を取得
3. `interruptedTools` を検出
4. `executor.startProtocol({ resumeSessionId, resumeMessageId, interruptedTools })` で resume

### prepare スクリプト失敗

1. `config.prepare` の exit code が非 0
2. `WorkspaceScriptProcess.complete(..., "failed", exitCode)` を記録
3. `fail("PREPARE_SCRIPT_FAILED", "Prepare script failed, agent not started")`

## 失敗 / 例外

- `NOT_FOUND` — `taskId` のタスクがない、もしくは親 project がない
- `WORKTREE_ERROR` — `ensureWorktreeExists` が投げた例外
- `PREPARE_SCRIPT_FAILED` — prepare スクリプトが失敗
- `INVALID_INPUT` — task に title がなく prompt が作れない
