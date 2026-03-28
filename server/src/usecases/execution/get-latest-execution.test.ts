import { describe, expect, test } from "bun:test";
import {
	createTestExecutionProcess,
	createTestSession,
	createTestWorkspace,
} from "../../../test/factories";
import { createMockContext } from "../../../test/helpers/context";
import { getLatestExecution } from "./get-latest-execution";

describe("getLatestExecution", () => {
	test("returns all null when no workspace exists for task", async () => {
		const ctx = createMockContext({
			workspace: {
				get: () => null,
			} as never,
		});

		const result = await getLatestExecution({ taskId: "task-1" }).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.workspaceId).toBeNull();
			expect(result.value.sessionId).toBeNull();
			expect(result.value.executionProcess).toBeNull();
		}
	});

	test("returns workspace with null session when no sessions exist", async () => {
		const workspace = createTestWorkspace();

		const ctx = createMockContext({
			workspace: {
				get: () => workspace,
			} as never,
			session: {
				list: () => ({ items: [], hasMore: false }),
			} as never,
		});

		const result = await getLatestExecution({
			taskId: workspace.taskId,
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.workspaceId).toBe(workspace.id);
			expect(result.value.sessionId).toBeNull();
			expect(result.value.executionProcess).toBeNull();
		}
	});

	test("returns workspace and session with null execution when no processes exist", async () => {
		const workspace = createTestWorkspace();
		const session = createTestSession({ workspaceId: workspace.id });

		const ctx = createMockContext({
			workspace: {
				get: () => workspace,
			} as never,
			session: {
				list: () => ({ items: [session], hasMore: false }),
			} as never,
			executionProcess: {
				list: () => ({ items: [], hasMore: false }),
			} as never,
		});

		const result = await getLatestExecution({
			taskId: workspace.taskId,
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.workspaceId).toBe(workspace.id);
			expect(result.value.sessionId).toBe(session.id);
			expect(result.value.executionProcess).toBeNull();
		}
	});

	test("returns full chain when all entities exist", async () => {
		const workspace = createTestWorkspace();
		const session = createTestSession({ workspaceId: workspace.id });
		const process = createTestExecutionProcess({
			sessionId: session.id,
			status: "running",
		});

		const ctx = createMockContext({
			workspace: {
				get: () => workspace,
			} as never,
			session: {
				list: () => ({ items: [session], hasMore: false }),
			} as never,
			executionProcess: {
				list: () => ({ items: [process], hasMore: false }),
			} as never,
		});

		const result = await getLatestExecution({
			taskId: workspace.taskId,
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.workspaceId).toBe(workspace.id);
			expect(result.value.sessionId).toBe(session.id);
			expect(result.value.executionProcess?.id).toBe(process.id);
			expect(result.value.executionProcess?.status).toBe("running");
		}
	});

	test("includes logs when includeLogs is true", async () => {
		const workspace = createTestWorkspace();
		const session = createTestSession({ workspaceId: workspace.id });
		const process = createTestExecutionProcess({ sessionId: session.id });
		const logs = {
			executionProcessId: process.id,
			logs: "Log content",
		};

		const ctx = createMockContext({
			workspace: {
				get: () => workspace,
			} as never,
			session: {
				list: () => ({ items: [session], hasMore: false }),
			} as never,
			executionProcess: {
				list: () => ({ items: [process], hasMore: false }),
			} as never,
			executionProcessLogs: {
				getLogs: (id: string) => (id === process.id ? logs : null),
			} as never,
		});

		const result = await getLatestExecution({
			taskId: workspace.taskId,
			includeLogs: true,
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.logs?.logs).toBe("Log content");
		}
	});

	test("returns null logs when logs not available", async () => {
		const workspace = createTestWorkspace();
		const session = createTestSession({ workspaceId: workspace.id });
		const process = createTestExecutionProcess({ sessionId: session.id });

		const ctx = createMockContext({
			workspace: {
				get: () => workspace,
			} as never,
			session: {
				list: () => ({ items: [session], hasMore: false }),
			} as never,
			executionProcess: {
				list: () => ({ items: [process], hasMore: false }),
			} as never,
			executionProcessLogs: {
				getLogs: () => null,
			} as never,
		});

		const result = await getLatestExecution({
			taskId: workspace.taskId,
			includeLogs: true,
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.logs).toBeNull();
		}
	});

	test("returns latest session based on sort order", async () => {
		const workspace = createTestWorkspace();
		const _oldSession = createTestSession({
			workspaceId: workspace.id,
			createdAt: new Date("2025-01-01"),
		});
		const newSession = createTestSession({
			workspaceId: workspace.id,
			createdAt: new Date("2025-01-15"),
		});

		// Mock returns newSession as the first item (latest based on desc sort)
		const ctx = createMockContext({
			workspace: {
				get: () => workspace,
			} as never,
			session: {
				list: () => ({ items: [newSession], hasMore: false }),
			} as never,
			executionProcess: {
				list: () => ({ items: [], hasMore: false }),
			} as never,
		});

		const result = await getLatestExecution({
			taskId: workspace.taskId,
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.sessionId).toBe(newSession.id);
		}
	});
});
