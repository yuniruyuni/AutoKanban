import { describe, expect, test } from "bun:test";
import {
	createTestCodingAgentProcess,
	createTestProject,
	createTestSession,
	createTestWorkspace,
} from "../../../test/factories";
import { createMockContext } from "../../../test/helpers/context";
import { cancelQueue, getQueueStatus, queueMessage } from "./queue-message";

describe("queueMessage", () => {
	test("queues message and returns not sent immediately when process is busy", async () => {
		const session = createTestSession();
		const workspace = createTestWorkspace({ id: session.workspaceId });
		const process = createTestCodingAgentProcess({
			sessionId: session.id,
			status: "running",
		});

		const queuedMessage = {
			sessionId: session.id,
			prompt: "Test prompt",
			queuedAt: new Date(),
		};

		const ctx = createMockContext({
			session: {
				get: () => session,
			} as never,
			workspace: {
				get: () => workspace,
			} as never,
			codingAgentProcess: {
				list: () => ({ items: [process], hasMore: false }),
			} as never,
			codingAgentProcessLogs: {
				getLogs: () => ({
					codingAgentProcessId: process.id,
					logs: '{"type":"assistant"}',
				}),
			} as never,
			workspaceRepo: {
				list: () => ({ items: [], hasMore: false }),
			} as never,
			codingAgentTurn: {
				findLatestResumeInfo: () => null,
			} as never,
			messageQueue: {
				queue: () => queuedMessage,
			} as never,
		});

		const result = await queueMessage({
			sessionId: session.id,
			prompt: "Test prompt",
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.sentImmediately).toBe(false);
			expect(result.value.queuedMessage.prompt).toBe("Test prompt");
		}
	});

	test("sends message immediately when no running process exists", async () => {
		const session = createTestSession();
		const workspace = createTestWorkspace({
			id: session.workspaceId,
			worktreePath: "/tmp/worktrees/ws1",
		});
		const project = createTestProject();

		const queuedMessage = {
			sessionId: session.id,
			prompt: "Test prompt",
			queuedAt: new Date(),
		};

		let startProtocolCalled = false;

		const ctx = createMockContext({
			session: {
				get: () => session,
			} as never,
			workspace: {
				get: () => workspace,
			} as never,
			codingAgentProcess: {
				list: () => ({ items: [], hasMore: false }),
				upsert: () => {},
			} as never,
			workspaceRepo: {
				list: () => ({
					items: [{ workspaceId: workspace.id, projectId: project.id }],
					hasMore: false,
				}),
			} as never,
			project: {
				get: () => project,
			} as never,
			codingAgentTurn: {
				findLatestResumeInfo: () => null,
				upsert: () => {},
			} as never,
			messageQueue: {
				queue: () => queuedMessage,
				consume: () => queuedMessage,
			} as never,
			executor: {
				startProtocol: async () => {
					startProtocolCalled = true;
					return {
						id: "new-process",
						sessionId: session.id,
						runReason: "codingagent",
						startedAt: new Date(),
					};
				},
			} as never,
		});

		const result = await queueMessage({
			sessionId: session.id,
			prompt: "Test prompt",
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.sentImmediately).toBe(true);
			expect(result.value.executionProcessId).toBeDefined();
		}
		expect(startProtocolCalled).toBe(true);
	});

	test("returns NOT_FOUND when session does not exist", async () => {
		const ctx = createMockContext({
			session: {
				get: () => null,
			} as never,
		});

		const result = await queueMessage({
			sessionId: "non-existent",
			prompt: "Test",
		}).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
			expect(result.error.message).toContain("Session not found");
		}
	});

	test("returns NOT_FOUND when workspace does not exist", async () => {
		const session = createTestSession();

		const ctx = createMockContext({
			session: {
				get: () => session,
			} as never,
			workspace: {
				get: () => null,
			} as never,
		});

		const result = await queueMessage({
			sessionId: session.id,
			prompt: "Test",
		}).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
			expect(result.error.message).toContain("Workspace not found");
		}
	});
});

describe("getQueueStatus", () => {
	test("returns queue status for existing session", async () => {
		const session = createTestSession();

		const ctx = createMockContext({
			session: {
				get: () => session,
			} as never,
			messageQueue: {
				getStatus: () => ({
					hasMessage: true,
					message: {
						sessionId: session.id,
						prompt: "Queued message",
						queuedAt: new Date(),
					},
				}),
			} as never,
		});

		const result = await getQueueStatus({ sessionId: session.id }).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.status.hasMessage).toBe(true);
			expect(result.value.status.message?.prompt).toBe("Queued message");
		}
	});

	test("returns NOT_FOUND when session does not exist", async () => {
		const ctx = createMockContext({
			session: {
				get: () => null,
			} as never,
		});

		const result = await getQueueStatus({ sessionId: "non-existent" }).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
		}
	});

	test("returns empty status when queue is empty", async () => {
		const session = createTestSession();

		const ctx = createMockContext({
			session: {
				get: () => session,
			} as never,
			messageQueue: {
				getStatus: () => ({ hasMessage: false }),
			} as never,
		});

		const result = await getQueueStatus({ sessionId: session.id }).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.status.hasMessage).toBe(false);
		}
	});
});

describe("cancelQueue", () => {
	test("cancels queue for existing session", async () => {
		const session = createTestSession();

		let cancelCalled = false;

		const ctx = createMockContext({
			session: {
				get: () => session,
			} as never,
			messageQueue: {
				cancel: () => {
					cancelCalled = true;
					return true;
				},
			} as never,
		});

		const result = await cancelQueue({ sessionId: session.id }).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.cancelled).toBe(true);
		}
		expect(cancelCalled).toBe(true);
	});

	test("returns NOT_FOUND when session does not exist", async () => {
		const ctx = createMockContext({
			session: {
				get: () => null,
			} as never,
		});

		const result = await cancelQueue({ sessionId: "non-existent" }).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
		}
	});

	test("returns cancelled=false when no message in queue", async () => {
		const session = createTestSession();

		const ctx = createMockContext({
			session: {
				get: () => session,
			} as never,
			messageQueue: {
				cancel: () => false,
			} as never,
		});

		const result = await cancelQueue({ sessionId: session.id }).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.cancelled).toBe(false);
		}
	});
});
