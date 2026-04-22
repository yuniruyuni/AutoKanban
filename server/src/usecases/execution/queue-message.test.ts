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
			agentSetting: {
				get: async () => null,
			},
			session: {
				get: async () => session,
			},
			workspace: {
				get: async () => workspace,
			},
			codingAgentProcess: {
				list: async () => ({ items: [process], hasMore: false }),
			},
			codingAgentProcessLogs: {
				getLogs: async () => ({
					codingAgentProcessId: process.id,
					logs: '{"type":"assistant"}',
				}),
				appendLogs: async () => {},
			},
			logStoreManager: {
				get: () => ({
					append: () => {},
				}),
			},
			workspaceRepo: {
				list: async () => ({ items: [], hasMore: false }),
			},
			codingAgentTurn: {
				findLatestResumeInfo: async () => null,
			},
			messageQueue: {
				queue: () => queuedMessage,
			},
		} as never);

		const result = await queueMessage(session.id, "Test prompt").run(ctx);

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
			agentSetting: {
				get: async () => null,
			},
			session: {
				get: async () => session,
			},
			workspace: {
				get: async () => workspace,
			},
			codingAgentProcess: {
				list: async () => ({ items: [], hasMore: false }),
				upsert: async () => {},
			},
			workspaceRepo: {
				list: async () => ({
					items: [{ workspaceId: workspace.id, projectId: project.id }],
					hasMore: false,
				}),
			},
			project: {
				get: async () => project,
			},
			codingAgentTurn: {
				findLatestResumeInfo: async () => null,
				upsert: async () => {},
			},
			messageQueue: {
				queue: () => queuedMessage,
				consume: () => queuedMessage,
			},
			logStoreManager: {
				get: () => ({
					append: () => {},
				}),
			},
			codingAgentProcessLogs: {
				appendLogs: async () => {},
			},
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
			},
		} as never);

		const result = await queueMessage(session.id, "Test prompt").run(ctx);

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
				get: async () => null,
			},
		} as never);

		const result = await queueMessage("non-existent", "Test").run(ctx);

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
				get: async () => session,
			},
			workspace: {
				get: async () => null,
			},
		} as never);

		const result = await queueMessage(session.id, "Test").run(ctx);

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
				get: async () => session,
			},
			messageQueue: {
				getStatus: () => ({
					hasMessage: true,
					message: {
						sessionId: session.id,
						prompt: "Queued message",
						queuedAt: new Date(),
					},
				}),
			},
		} as never);

		const result = await getQueueStatus(session.id).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.status.hasMessage).toBe(true);
			expect(result.value.status.message?.prompt).toBe("Queued message");
		}
	});

	test("returns NOT_FOUND when session does not exist", async () => {
		const ctx = createMockContext({
			session: {
				get: async () => null,
			},
		} as never);

		const result = await getQueueStatus("non-existent").run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
		}
	});

	test("returns empty status when queue is empty", async () => {
		const session = createTestSession();

		const ctx = createMockContext({
			session: {
				get: async () => session,
			},
			messageQueue: {
				getStatus: () => ({ hasMessage: false }),
			},
		} as never);

		const result = await getQueueStatus(session.id).run(ctx);

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
				get: async () => session,
			},
			messageQueue: {
				cancel: () => {
					cancelCalled = true;
					return true;
				},
			},
		} as never);

		const result = await cancelQueue(session.id).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.cancelled).toBe(true);
		}
		expect(cancelCalled).toBe(true);
	});

	test("returns NOT_FOUND when session does not exist", async () => {
		const ctx = createMockContext({
			session: {
				get: async () => null,
			},
		} as never);

		const result = await cancelQueue("non-existent").run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
		}
	});

	test("returns cancelled=false when no message in queue", async () => {
		const session = createTestSession();

		const ctx = createMockContext({
			session: {
				get: async () => session,
			},
			messageQueue: {
				cancel: () => false,
			},
		} as never);

		const result = await cancelQueue(session.id).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.cancelled).toBe(false);
		}
	});
});
