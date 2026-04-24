import { describe, expect, test } from "bun:test";
import {
	createTestCodingAgentProcess,
	createTestSession,
	createTestTask,
	createTestWorkspace,
} from "../../../../test/factories";
import { createMockContext } from "../../../../test/helpers/context";
import type { ProcessCompletionInfo } from "../../../infra/callback/client";
import type { Task } from "../../../models/task";
import { handleProcessComplete } from "./on-process-complete";

// ============================================
// Helpers
// ============================================

function setupMocks(options: {
	queuedMessage?:
		| { sessionId: string; prompt: string; queuedAt: Date }
		| undefined;
	taskStatus?: string;
	processType?: "codingagent" | "devserver" | "workspacescript";
}) {
	const session = createTestSession();
	const workspace = createTestWorkspace({ id: session.workspaceId });
	const task = createTestTask({
		id: workspace.taskId,
		status: (options.taskStatus ?? "inprogress") as Task.Status,
	});
	const codingAgentProcess = createTestCodingAgentProcess({
		sessionId: session.id,
		status: "running",
	});

	const calls = {
		codingAgentProcessUpserted: false,
		devServerProcessUpserted: false,
		workspaceScriptProcessUpserted: false,
		taskUpserted: false,
		logStoreManagerClosed: false,
		executorStartCalled: false,
	};

	const ctx = createMockContext({
		codingAgentProcess: {
			get: () => codingAgentProcess,
			upsert: () => {
				calls.codingAgentProcessUpserted = true;
			},
			list: () => ({ items: [], hasMore: false }),
		} as never,
		devServerProcess: {
			get: () => null,
			upsert: () => {
				calls.devServerProcessUpserted = true;
			},
			list: () => ({ items: [], hasMore: false }),
		} as never,
		workspaceScriptProcess: {
			get: () => null,
			upsert: () => {
				calls.workspaceScriptProcessUpserted = true;
			},
			list: () => ({ items: [], hasMore: false }),
		} as never,
		codingAgentProcessLogs: {
			getLogs: () => null,
		} as never,
		session: {
			get: () => session,
		} as never,
		workspace: {
			get: () => workspace,
		} as never,
		workspaceRepo: {
			list: () => ({ items: [], hasMore: false }),
		} as never,
		task: {
			get: () => task,
			upsert: () => {
				calls.taskUpserted = true;
			},
		} as never,
		codingAgentTurn: {
			findLatestResumeInfo: () => null,
			upsert: () => {},
		} as never,
		logStoreManager: {
			close: () => {
				calls.logStoreManagerClosed = true;
			},
		} as never,
		messageQueue: {
			consume: () => options.queuedMessage,
		} as never,
		executor: {
			start: async () => {
				calls.executorStartCalled = true;
			},
			startProtocol: async () => {
				calls.executorStartCalled = true;
			},
		} as never,
		previewProxy: {
			start: () => {},
			stop: () => false,
			setTarget: () => {},
			getTarget: () => null,
		} as never,
	});

	return { ctx, session, calls };
}

// ============================================
// Tests
// ============================================

describe("handleProcessComplete", () => {
	test("completed + no queued message → moves task to inreview", async () => {
		const { ctx, session, calls } = setupMocks({
			queuedMessage: undefined,
		});

		const info: ProcessCompletionInfo = {
			processId: "proc-1",
			sessionId: session.id,
			processType: "codingagent",
			status: "completed",
			exitCode: 0,
		};

		await handleProcessComplete(ctx, info);

		expect(calls.codingAgentProcessUpserted).toBe(true);
		expect(calls.taskUpserted).toBe(true);
		expect(calls.executorStartCalled).toBe(false);
	});

	test("completed + queued message → processes follow-up, does NOT move task to inreview", async () => {
		const { ctx, session, calls } = setupMocks({
			queuedMessage: {
				sessionId: "test-session",
				prompt: "Continue working",
				queuedAt: new Date(),
			},
		});

		const info: ProcessCompletionInfo = {
			processId: "proc-1",
			sessionId: session.id,
			processType: "codingagent",
			status: "completed",
			exitCode: 0,
		};

		await handleProcessComplete(ctx, info);

		expect(calls.codingAgentProcessUpserted).toBe(true);
		// executor.start is not called because workingDir is null (no workspaceRepo)
		// but the queued message IS consumed and processQueuedFollowUp runs
		expect(calls.taskUpserted).toBe(false);
	});

	test("killed + queued message → should process follow-up (BUG: currently ignored)", async () => {
		const { ctx, session, calls } = setupMocks({
			queuedMessage: {
				sessionId: "test-session",
				prompt: "Resume after stop",
				queuedAt: new Date(),
			},
		});

		const info: ProcessCompletionInfo = {
			processId: "proc-1",
			sessionId: session.id,
			processType: "codingagent",
			status: "killed",
			exitCode: null,
		};

		await handleProcessComplete(ctx, info);

		// After fix: queued message should be consumed and follow-up processed
		// taskUpserted should be false because processQueuedFollowUp runs instead of moveTaskToInReview
		expect(calls.taskUpserted).toBe(false);
	});

	test("failed + queued message → should process follow-up", async () => {
		const { ctx, session, calls } = setupMocks({
			queuedMessage: {
				sessionId: "test-session",
				prompt: "Retry after failure",
				queuedAt: new Date(),
			},
		});

		const info: ProcessCompletionInfo = {
			processId: "proc-1",
			sessionId: session.id,
			processType: "codingagent",
			status: "failed",
			exitCode: 1,
		};

		await handleProcessComplete(ctx, info);

		expect(calls.taskUpserted).toBe(false);
	});

	test("killed + no queued message → moves task to inreview", async () => {
		const { ctx, session, calls } = setupMocks({
			queuedMessage: undefined,
		});

		const info: ProcessCompletionInfo = {
			processId: "proc-1",
			sessionId: session.id,
			processType: "codingagent",
			status: "killed",
			exitCode: null,
		};

		await handleProcessComplete(ctx, info);

		expect(calls.codingAgentProcessUpserted).toBe(true);
		expect(calls.taskUpserted).toBe(true);
	});

	test("workspacescript completed → does NOT move task to inreview", async () => {
		const { ctx, session, calls } = setupMocks({
			queuedMessage: undefined,
			processType: "workspacescript",
		});

		const info: ProcessCompletionInfo = {
			processId: "proc-1",
			sessionId: session.id,
			processType: "workspacescript",
			status: "completed",
			exitCode: 0,
		};

		await handleProcessComplete(ctx, info);

		// workspacescript processes don't trigger task status changes
		expect(calls.taskUpserted).toBe(false);
		expect(calls.executorStartCalled).toBe(false);
	});

	test("devserver completed → does NOT move task to inreview", async () => {
		const { ctx, session, calls } = setupMocks({
			queuedMessage: undefined,
			processType: "devserver",
		});

		const info: ProcessCompletionInfo = {
			processId: "proc-1",
			sessionId: session.id,
			processType: "devserver",
			status: "completed",
			exitCode: 0,
		};

		await handleProcessComplete(ctx, info);

		expect(calls.taskUpserted).toBe(false);
		expect(calls.executorStartCalled).toBe(false);
	});
});
