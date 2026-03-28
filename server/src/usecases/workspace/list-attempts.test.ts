import { describe, expect, test } from "bun:test";
import {
	createTestExecutionProcess,
	createTestSession,
	createTestWorkspace,
} from "../../../test/factories";
import { createMockContext } from "../../../test/helpers/context";
import { listAttempts } from "./list-attempts";

describe("listAttempts", () => {
	test("returns empty attempts when no workspaces exist", async () => {
		const ctx = createMockContext({
			workspace: {
				list: () => ({ items: [], nextCursor: null }),
			} as never,
		});

		const result = await listAttempts({ taskId: "task-1" }).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.attempts).toEqual([]);
			expect(result.value.activeAttempt).toBeNull();
		}
	});

	test("returns single active attempt with session and execution", async () => {
		const workspace = createTestWorkspace({
			id: "ws-1",
			taskId: "task-1",
			attempt: 1,
			archived: false,
			branch: "ak-task1-1",
		});
		const session = createTestSession({
			id: "session-1",
			workspaceId: "ws-1",
		});
		const ep = createTestExecutionProcess({
			id: "ep-1",
			sessionId: "session-1",
			runReason: "codingagent",
			status: "completed",
		});

		const ctx = createMockContext({
			workspace: {
				list: () => ({ items: [workspace], nextCursor: null }),
			} as never,
			session: {
				list: () => ({ items: [session], nextCursor: null }),
			} as never,
			executionProcess: {
				list: () => ({ items: [ep], nextCursor: null }),
			} as never,
		});

		const result = await listAttempts({ taskId: "task-1" }).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.attempts).toHaveLength(1);
			expect(result.value.attempts[0].workspaceId).toBe("ws-1");
			expect(result.value.attempts[0].attempt).toBe(1);
			expect(result.value.attempts[0].archived).toBe(false);
			expect(result.value.attempts[0].sessionId).toBe("session-1");
			expect(result.value.attempts[0].latestStatus).toBe("completed");
			expect(result.value.activeAttempt).toBe(1);
		}
	});

	test("returns multiple attempts with correct active attempt", async () => {
		const ws1 = createTestWorkspace({
			id: "ws-1",
			taskId: "task-1",
			attempt: 1,
			archived: true,
			branch: "ak-task1-1",
			createdAt: new Date("2025-01-01"),
		});
		const ws2 = createTestWorkspace({
			id: "ws-2",
			taskId: "task-1",
			attempt: 2,
			archived: false,
			branch: "ak-task1-2",
			createdAt: new Date("2025-01-02"),
		});
		const session1 = createTestSession({
			id: "session-1",
			workspaceId: "ws-1",
		});
		const session2 = createTestSession({
			id: "session-2",
			workspaceId: "ws-2",
		});
		const ep1 = createTestExecutionProcess({
			sessionId: "session-1",
			runReason: "codingagent",
			status: "failed",
		});
		const ep2 = createTestExecutionProcess({
			sessionId: "session-2",
			runReason: "codingagent",
			status: "running",
		});

		const ctx = createMockContext({
			workspace: {
				list: () => ({ items: [ws1, ws2], nextCursor: null }),
			} as never,
			session: {
				list: (spec: { workspaceId?: string }) => {
					if ("workspaceId" in spec && spec.workspaceId === "ws-1")
						return { items: [session1], nextCursor: null };
					return { items: [session2], nextCursor: null };
				},
			} as never,
			executionProcess: {
				list: (spec: { sessionId?: string }) => {
					if ("sessionId" in spec && spec.sessionId === "session-1")
						return { items: [ep1], nextCursor: null };
					return { items: [ep2], nextCursor: null };
				},
			} as never,
		});

		const result = await listAttempts({ taskId: "task-1" }).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.attempts).toHaveLength(2);
			expect(result.value.attempts[0].attempt).toBe(1);
			expect(result.value.attempts[0].archived).toBe(true);
			expect(result.value.attempts[1].attempt).toBe(2);
			expect(result.value.attempts[1].archived).toBe(false);
			expect(result.value.activeAttempt).toBe(2);
		}
	});

	test("returns null sessionId and latestStatus when no session exists", async () => {
		const workspace = createTestWorkspace({
			id: "ws-1",
			taskId: "task-1",
			attempt: 1,
			archived: false,
		});

		const ctx = createMockContext({
			workspace: {
				list: () => ({ items: [workspace], nextCursor: null }),
			} as never,
			session: {
				list: () => ({ items: [], nextCursor: null }),
			} as never,
		});

		const result = await listAttempts({ taskId: "task-1" }).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.attempts[0].sessionId).toBeNull();
			expect(result.value.attempts[0].latestStatus).toBeNull();
		}
	});
});
