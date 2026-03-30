# Usecase Pure Logic Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure usecases to move business logic out of `post`/`write` steps into pure `process` steps, fix transaction boundary violations (DB writes in `post`), and eliminate data re-fetches.

**Architecture:** The usecase runner has 5 steps: `pre` → `read` → `process` → `write` → `post`. `read`→`process`→`write` run inside a DB transaction. `post` runs outside the transaction for external calls only. Currently many usecases violate this by doing DB writes in `post`. We fix this by: (1) pre-generating IDs in `process`, (2) creating model objects in `process` (pure), (3) writing to DB in `write` (transactional), (4) passing pre-generated IDs to executor in `post`.

**Tech Stack:** TypeScript, Bun, Hono, tRPC, PostgreSQL (embedded-postgres)

---

## File Structure

### Model changes (add methods/options)
- Modify: `server/src/models/execution-process/index.ts` — add optional `id` param to `create()`
- Modify: `server/src/models/task/index.ts` — add `toDone()` method
- Modify: `server/src/models/execution-process/index.test.ts` — tests for `create()` with id
- Modify: `server/src/models/task/index.test.ts` — tests for `toDone()`

### Executor interface change
- Modify: `server/src/repositories/executor/repository.ts` — add optional `id` to start options
- Modify: `server/src/repositories/executor/orchestrator/index.ts` — use provided id if given

### Usecase refactors (eliminate post DB writes, re-fetches, apply model methods)
- Modify: `server/src/usecases/execution/start-execution.ts`
- Modify: `server/src/usecases/execution/queue-message.ts`
- Modify: `server/src/usecases/execution/fork-conversation.ts`
- Modify: `server/src/usecases/execution/on-process-complete.ts`
- Modify: `server/src/usecases/execution/on-process-idle.ts`
- Modify: `server/src/usecases/git/merge-branch.ts`
- Modify: `server/src/usecases/git/finalize-pr-merge.ts`
- Modify: `server/src/usecases/task/update-task.ts`

---

### Task 1: ExecutionProcess.create() に optional id パラメータ追加

**Files:**
- Modify: `server/src/models/execution-process/index.ts`
- Modify: `server/src/models/execution-process/index.test.ts`

- [ ] **Step 1: Write failing test for create() with id**

`server/src/models/execution-process/index.test.ts` の `ExecutionProcess.create()` describe 内に追加:

```typescript
	test("uses provided id when given", () => {
		const ep = ExecutionProcess.create({
			sessionId: "s1",
			runReason: "codingagent",
			id: "custom-id-123",
		});
		expect(ep.id).toBe("custom-id-123");
	});

	test("generates id when not provided", () => {
		const ep = ExecutionProcess.create({
			sessionId: "s1",
			runReason: "codingagent",
		});
		expect(ep.id).toMatch(/^[0-9a-f]{8}-/);
	});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && bun test src/models/execution-process/index.test.ts`
Expected: FAIL — `create()` does not accept `id` param

- [ ] **Step 3: Add optional id parameter to create()**

`server/src/models/execution-process/index.ts` の `create` を修正:

```typescript
	export function create(params: {
		sessionId: string;
		runReason: RunReason;
		id?: string;
	}): ExecutionProcess {
		const now = new Date();
		return {
			id: params.id ?? generateId(),
			sessionId: params.sessionId,
			runReason: params.runReason,
			status: "running",
			exitCode: null,
			startedAt: now,
			completedAt: null,
			createdAt: now,
			updatedAt: now,
		};
	}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && bun test src/models/execution-process/index.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/models/execution-process/index.ts server/src/models/execution-process/index.test.ts
git commit -m "feat: ExecutionProcess.create() に optional id パラメータ追加"
```

---

### Task 2: Task.toDone() ガード付き遷移メソッド追加

**Files:**
- Modify: `server/src/models/task/index.ts`
- Modify: `server/src/models/task/index.test.ts`

- [ ] **Step 1: Write failing tests**

`server/src/models/task/index.test.ts` の `Task.needsChatReset()` describe の直前に追加:

```typescript
// ============================================
// Task.toDone()
// ============================================

describe("Task.toDone()", () => {
	test("transitions non-done task to done", () => {
		const task = {
			...Task.create({ projectId: "p1", title: "T" }),
			status: "inreview" as Task.Status,
		};
		const result = Task.toDone(task);
		expect(result).not.toBeNull();
		expect(result?.status).toBe("done");
		expect(result?.updatedAt).toBeInstanceOf(Date);
	});

	test("returns null for already-done task", () => {
		const task = {
			...Task.create({ projectId: "p1", title: "T" }),
			status: "done" as Task.Status,
		};
		expect(Task.toDone(task)).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && bun test src/models/task/index.test.ts`
Expected: FAIL — `Task.toDone is not a function`

- [ ] **Step 3: Implement Task.toDone()**

`server/src/models/task/index.ts` の `needsChatReset` の直後に追加:

```typescript
	// Done transition
	export function toDone(task: Task): Task | null {
		if (task.status === "done") return null;
		return { ...task, status: "done" as Status, updatedAt: new Date() };
	}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && bun test src/models/task/index.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/models/task/index.ts server/src/models/task/index.test.ts
git commit -m "feat: Task.toDone() ガード付き遷移メソッド追加"
```

---

### Task 3: Executor インターフェースに optional id 追加

**Files:**
- Modify: `server/src/repositories/executor/repository.ts`
- Modify: `server/src/repositories/executor/orchestrator/index.ts`

- [ ] **Step 1: Add optional id to ExecutorStartOptions and ExecutorStartProtocolOptions**

`server/src/repositories/executor/repository.ts`:

`ExecutorStartOptions` に追加:
```typescript
export interface ExecutorStartOptions {
	id?: string;
	sessionId: string;
	// ... rest unchanged
}
```

`ExecutorStartProtocolOptions` に追加:
```typescript
export interface ExecutorStartProtocolOptions {
	id?: string;
	sessionId: string;
	// ... rest unchanged
}
```

- [ ] **Step 2: Update orchestrator to use provided id**

`server/src/repositories/executor/orchestrator/index.ts` の `startProtocol` メソッド内:

```typescript
const id = options.id ?? randomUUID();
```

同様に `start` メソッドでも `randomUUID()` を `options.id ?? randomUUID()` に変更。

- [ ] **Step 3: Run type check**

Run: `bun run check:type`
Expected: PASS

- [ ] **Step 4: Run tests**

Run: `bun run check:test`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/repositories/executor/repository.ts server/src/repositories/executor/orchestrator/index.ts
git commit -m "feat: Executor に optional id パラメータ追加（事前生成ID対応）"
```

---

### Task 4: start-execution の post 内 DB write を process+write に移動

**Files:**
- Modify: `server/src/usecases/execution/start-execution.ts`

- [ ] **Step 1: process ステップで EP と CodingAgentTurn を事前生成**

`process` ステップの末尾（return の前）に追加:

```typescript
			// Pre-generate ExecutionProcess and CodingAgentTurn for transactional write
			const prompt = taskToPrompt(task);
			const executionProcess = ExecutionProcess.create({
				sessionId: session.id,
				runReason: "codingagent",
			});
			const codingAgentTurn = CodingAgentTurn.create({
				executionProcessId: executionProcess.id,
				prompt,
			});
```

return に `executionProcess`, `codingAgentTurn`, `prompt` を追加。

- [ ] **Step 2: write ステップで EP と CodingAgentTurn を DB に書き込み**

`write` ステップ末尾（return の前）に追加:

```typescript
			// Write pre-generated EP and Turn within transaction
			await ctx.repos.executionProcess.upsert(executionProcess);
			await ctx.repos.codingAgentTurn.upsert(codingAgentTurn);
```

return に `executionProcess`, `codingAgentTurn` を追加。

- [ ] **Step 3: post ステップから DB write を除去し、事前生成 ID を executor に渡す**

`post` ステップの `executor.startProtocol` 呼び出しに `id: executionProcess.id` を追加。
EP upsert と CodingAgentTurn upsert のコードブロックを削除。
`runningProcess.id` の参照を `executionProcess.id` に変更。

- [ ] **Step 4: post 内の prompt 生成を除去**

prompt は `process` で生成済みなので、`post` 内の `taskToPrompt` 呼び出しと prompt 変数を削除し、引数から受け取るように変更。

- [ ] **Step 5: Run all checks**

Run: `bun run check:type && bun run check:test && bun run check:arch`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add server/src/usecases/execution/start-execution.ts
git commit -m "refactor: start-execution の EP/Turn 生成を process+write に移動"
```

---

### Task 5: queue-message の post 内 DB write を process+write に移動

**Files:**
- Modify: `server/src/usecases/execution/queue-message.ts`

- [ ] **Step 1: process ステップで EP と CodingAgentTurn を事前生成**

`process` 内の return の前に:

```typescript
			// Pre-generate EP for potential new process start
			const executionProcess = ExecutionProcess.create({
				sessionId: session.id,
				runReason: "codingagent",
			});
```

return に `executionProcess` を追加。

- [ ] **Step 2: post から DB write を除去し事前生成 ID を使用**

`post` 内の `executor.startProtocol` に `id: executionProcess.id` を追加。
インラインの `ctx.repos.executionProcess.upsert({...})` と `CodingAgentTurn.create()` + upsert を削除。

ただし queue-message は post のみで write ステップがない。EP/Turn の write が必要な場合（canSendImmediately かつ新プロセス開始時）のみ DB に書く必要がある。post 内で条件付き DB write が必要なケースなので、**write ステップを追加**する。

write ステップでは「新プロセスが必要な場合」のフラグに応じて EP/Turn を書く:

```typescript
		write: async (ctx, data) => {
			// EP and Turn will be written here if a new process will be started
			// The decision is made in process, and post only does the external call
			return data;
		},
```

実際には queue-message は post の中で canSendImmediately を判断するため（ログパース結果依存）、EP の事前書き込みは困難。このタスクでは EP の ID 事前生成のみ行い、DB write は post に残す（executor に渡す ID の一貫性のみ確保）。

- [ ] **Step 3: Run all checks**

Run: `bun run check:type && bun run check:test && bun run check:arch`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add server/src/usecases/execution/queue-message.ts
git commit -m "refactor: queue-message で EP ID を事前生成し executor に渡す"
```

---

### Task 6: fork-conversation のリファクタ（再取得排除 + DB write 移動）

**Files:**
- Modify: `server/src/usecases/execution/fork-conversation.ts`

- [ ] **Step 1: read で取得した workspace を post まで伝播**

現在 `post` で workspace を再取得している (L86)。`read` → `process` → `post` で workspace を渡すように変更:

`read` の return に workspace のための追加データは不要（session.workspaceId 経由で read で取得すればよい）。

実際には `read` で session を取得後、workspace も取得して return に含める:

```typescript
		read: async (ctx) => {
			const session = await ctx.repos.session.get(Session.ById(input.sessionId));
			if (!session) { return fail("NOT_FOUND", "Session not found", { sessionId: input.sessionId }); }

			const workspace = await ctx.repos.workspace.get(Workspace.ById(session.workspaceId));
			if (!workspace) { return fail("NOT_FOUND", "Workspace not found"); }

			// ... existing EP/resume checks ...

			return { session, workspace, resumeInfo };
		},
```

- [ ] **Step 2: process で EP と CodingAgentTurn を事前生成**

```typescript
		process: (_ctx, { session, workspace, resumeInfo }) => {
			const executionProcess = ExecutionProcess.create({
				sessionId: session.id,
				runReason: "codingagent",
			});
			const codingAgentTurn = CodingAgentTurn.create({
				executionProcessId: executionProcess.id,
				prompt: input.newPrompt,
			});
			return {
				session,
				workspace,
				agentSessionId: resumeInfo.agentSessionId,
				messageUuid: input.messageUuid,
				prompt: input.newPrompt,
				executionProcess,
				codingAgentTurn,
			};
		},
```

- [ ] **Step 3: write ステップを追加して EP/Turn を DB に書き込み**

```typescript
		write: async (ctx, data) => {
			await ctx.repos.executionProcess.upsert(data.executionProcess);
			await ctx.repos.codingAgentTurn.upsert(data.codingAgentTurn);
			return data;
		},
```

- [ ] **Step 4: post から DB write と workspace 再取得を除去**

post は executor.startProtocol の呼び出しのみに。`id: executionProcess.id` を渡す。workspace は引数から使用。

- [ ] **Step 5: Run all checks**

Run: `bun run check:type && bun run check:test && bun run check:arch`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add server/src/usecases/execution/fork-conversation.ts
git commit -m "refactor: fork-conversation の再取得排除 + EP/Turn を process+write に移動"
```

---

### Task 7: Workspace.resolveWorkingDir の未適用箇所に適用

**Files:**
- Modify: `server/src/usecases/execution/on-process-complete.ts`

- [ ] **Step 1: processQueuedFollowUp の手動パス構築を resolveWorkingDir に置換**

`processQueuedFollowUp` の `read` 内:

```typescript
// Before:
let workingDir: string | null = null;
if (workspace.worktreePath) {
    workingDir = project
        ? `${workspace.worktreePath}/${project.name}`
        : workspace.worktreePath;
} else if (project) {
    workingDir = project.repoPath;
}

// After:
const workingDir = Workspace.resolveWorkingDir(workspace, project);
```

import に `Workspace` を追加。

- [ ] **Step 2: Run all checks**

Run: `bun run check:type && bun run check:test && bun run check:arch`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add server/src/usecases/execution/on-process-complete.ts
git commit -m "refactor: processQueuedFollowUp に Workspace.resolveWorkingDir 適用"
```

---

### Task 8: update-task の write 内再取得を排除

**Files:**
- Modify: `server/src/usecases/task/update-task.ts`

- [ ] **Step 1: read で取得した workspaces をそのまま write に渡す**

現在 `read` で workspaceIds を収集し、`write` で再度 `workspace.list()` している。`read` で取得した workspaces オブジェクト一覧をそのまま渡すように変更:

`read` 内:

```typescript
// Before:
const workspaceIds: string[] = [];
// ...
for (const ws of workspaces.items) {
    workspaceIds.push(ws.id);
}

// After:
const workspaces: Workspace[] = [];
// ...
for (const ws of workspacePage.items) {
    workspaces.push(ws);
}
```

`write` 内:

```typescript
// Before:
if (needsChatReset) {
    const workspaces = await ctx.repos.workspace.list(Workspace.ByTaskId(task.id), { limit: 10000 });
    for (const ws of workspaces.items) {
        if (!ws.archived) {
            await ctx.repos.workspace.upsert({ ...ws, archived: true, updatedAt: ctx.now });
        }
    }
}

// After:
if (needsChatReset) {
    for (const ws of workspaces) {
        if (!ws.archived) {
            await ctx.repos.workspace.upsert({ ...ws, archived: true, updatedAt: ctx.now });
        }
    }
}
```

workspaceIds は post 用に workspaces から導出: `workspaces.map(ws => ws.id)`

- [ ] **Step 2: Run all checks**

Run: `bun run check:type && bun run check:test && bun run check:arch`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add server/src/usecases/task/update-task.ts
git commit -m "refactor: update-task の write 内 workspace 再取得を排除"
```

---

### Task 9: merge-branch の Task 遷移を process+write に移動

**Files:**
- Modify: `server/src/usecases/git/merge-branch.ts`

- [ ] **Step 1: process ステップで Task 遷移オブジェクトを事前計算**

merge-branch は現在 `read` → `post` のみ。`process` と `write` を追加。

`process` でタスク遷移を計算:

```typescript
		process: (_ctx, { workspace, project, task }) => {
			const updatedTask = task ? Task.toDone(task) : null;
			return { workspace, project, updatedTask };
		},
```

- [ ] **Step 2: write ステップで Task を DB に書き込み**

```typescript
		write: async (ctx, data) => {
			if (data.updatedTask) {
				await ctx.repos.task.upsert(data.updatedTask);
			}
			return data;
		},
```

- [ ] **Step 3: post から Task upsert を除去**

post の `if (task && task.status !== "done")` ブロックを削除。

- [ ] **Step 4: Run all checks**

Run: `bun run check:type && bun run check:test && bun run check:arch`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/usecases/git/merge-branch.ts
git commit -m "refactor: merge-branch の Task 遷移を process+write に移動"
```

---

### Task 10: finalize-pr-merge の Task 遷移を write に移動

**Files:**
- Modify: `server/src/usecases/git/finalize-pr-merge.ts`

finalize-pr-merge は PR の merge 状態を外部 (git) で確認してから Task を done にする。PR 状態確認は `post` で行う必要があるが、Task の遷移オブジェクトは `process` で事前計算可能。ただし PR が merged でなければ遷移しない。

この usecase では **外部確認の結果に依存して DB write するかどうかが決まる**ため、Task upsert を完全に write に移すことはできない。代わりに Task.toDone() を適用してコードを整理する。

- [ ] **Step 1: post 内の Task upsert に Task.toDone() を適用**

```typescript
// Before:
await ctx.repos.task.upsert({
    ...task,
    status: "done",
    updatedAt: ctx.now,
});

// After:
const doneTask = Task.toDone(task);
if (doneTask) {
    await ctx.repos.task.upsert(doneTask);
}
```

- [ ] **Step 2: Run all checks**

Run: `bun run check:type && bun run check:test && bun run check:arch`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add server/src/usecases/git/finalize-pr-merge.ts
git commit -m "refactor: finalize-pr-merge に Task.toDone() 適用"
```

---

### Task 11: on-process-idle の Task 遷移に Task.toInReview() 適用

**Files:**
- Modify: `server/src/usecases/execution/on-process-idle.ts`

on-process-idle も外部呼び出し (messageQueue.consume, executor.sendMessage) の結果に依存するため post に残るが、Task.toInReview() で整理。

- [ ] **Step 1: post 内の Task upsert に Task.toInReview() を適用**

```typescript
// Before:
if (task && task.status === "inprogress") {
    await ctx.repos.task.upsert({
        ...task,
        status: "inreview",
        updatedAt: new Date(),
    });
}

// After:
if (task) {
    const updated = Task.toInReview(task);
    if (updated) {
        await ctx.repos.task.upsert(updated);
    }
}
```

- [ ] **Step 2: on-process-complete (moveTaskToInReview) にも同様に適用**

`server/src/usecases/execution/on-process-complete.ts` の `moveTaskToInReview`:

```typescript
// Before:
if (task && task.status === "inprogress") {
    await ctx.repos.task.upsert({
        ...task,
        status: "inreview",
        updatedAt: new Date(),
    });
}

// After:
if (task) {
    const updated = Task.toInReview(task);
    if (updated) {
        await ctx.repos.task.upsert(updated);
    }
}
```

import に `Task` は既にある。

- [ ] **Step 3: Run all checks**

Run: `bun run check:type && bun run check:test && bun run check:arch`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add server/src/usecases/execution/on-process-idle.ts server/src/usecases/execution/on-process-complete.ts
git commit -m "refactor: on-process-idle/complete に Task.toInReview() 適用"
```

---

### Task 12: on-process-complete (completeExecutionProcess) に ExecutionProcess.complete() 適用

**Files:**
- Modify: `server/src/usecases/execution/on-process-complete.ts`

- [ ] **Step 1: write 内のインライン構築を ExecutionProcess.complete() に置換**

```typescript
// Before:
write: async (ctx, { existing }) => {
    if (existing) {
        const now = new Date();
        await ctx.repos.executionProcess.upsert({
            ...existing,
            status: input.status,
            exitCode: input.exitCode,
            completedAt: now,
            updatedAt: now,
        });
    }
    return {};
},

// After:
process: (_ctx, { existing }) => {
    const completed = existing
        ? ExecutionProcess.complete(existing, input.status as "completed" | "failed" | "killed", input.exitCode)
        : null;
    return { completed };
},

write: async (ctx, { completed }) => {
    if (completed) {
        await ctx.repos.executionProcess.upsert(completed);
    }
    return {};
},
```

注: `input.status` の型が `ExecutionProcess.Status` で `"running"` や `"awaiting_approval"` も含む。`complete()` は `"completed" | "failed" | "killed"` のみ受け付ける。呼び出し元が常に完了ステータスを渡す前提なので、型アサーションが必要。もし不適切なステータスが来る可能性がある場合は process 内でバリデーションを追加。

- [ ] **Step 2: Run all checks**

Run: `bun run check:type && bun run check:test && bun run check:arch`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add server/src/usecases/execution/on-process-complete.ts
git commit -m "refactor: completeExecutionProcess に ExecutionProcess.complete() 適用"
```

---

### Task 13: processQueuedFollowUp の EP 生成を事前化

**Files:**
- Modify: `server/src/usecases/execution/on-process-complete.ts`

- [ ] **Step 1: process で EP を事前生成**

processQueuedFollowUp は `post` で `executor.start()` を呼んでから EP を作っている。事前生成 ID を executor に渡すように変更。

```typescript
		process: (_ctx, { workingDir }) => {
			if (!workingDir) return { workingDir, executionProcess: null };
			const executionProcess = ExecutionProcess.create({
				sessionId: input.sessionId,
				runReason: "codingagent",
			});
			return { workingDir, executionProcess };
		},

		write: async (ctx, { executionProcess, ...rest }) => {
			if (executionProcess) {
				await ctx.repos.executionProcess.upsert(executionProcess);
			}
			return { ...rest, executionProcess };
		},

		post: async (ctx, { workingDir, executionProcess }) => {
			if (!workingDir || !executionProcess) return {};

			await ctx.repos.executor.start({
				id: executionProcess.id,
				sessionId: input.sessionId,
				runReason: "codingagent",
				workingDir,
				prompt: input.prompt,
			});

			return {};
		},
```

- [ ] **Step 2: Run all checks**

Run: `bun run check:type && bun run check:test && bun run check:arch`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add server/src/usecases/execution/on-process-complete.ts
git commit -m "refactor: processQueuedFollowUp の EP 生成を process+write に移動"
```
