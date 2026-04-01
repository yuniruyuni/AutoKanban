import { describe, expect, test } from "bun:test";
import {
	createTestCodingAgentProcess,
	createTestSession,
} from "../../../test/factories";
import { createMockContext } from "../../../test/helpers/context";
import { getAttemptExecution } from "./get-attempt-execution";

describe("getAttemptExecution", () => {
	test("returns null session and execution when no session exists", async () => {
		const ctx = createMockContext({
			session: {
				list: () => ({ items: [], nextCursor: null }),
			} as never,
		});

		const result = await getAttemptExecution({
			workspaceId: "ws-1",
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.workspaceId).toBe("ws-1");
			expect(result.value.sessionId).toBeNull();
			expect(result.value.executionProcessId).toBeNull();
		}
	});

	test("returns session but null execution when no coding agent process exists", async () => {
		const session = createTestSession({
			id: "session-1",
			workspaceId: "ws-1",
		});

		const ctx = createMockContext({
			session: {
				list: () => ({ items: [session], nextCursor: null }),
			} as never,
			codingAgentProcess: {
				list: () => ({ items: [], nextCursor: null }),
			} as never,
		});

		const result = await getAttemptExecution({
			workspaceId: "ws-1",
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.workspaceId).toBe("ws-1");
			expect(result.value.sessionId).toBe("session-1");
			expect(result.value.executionProcessId).toBeNull();
		}
	});

	test("returns full execution chain", async () => {
		const session = createTestSession({
			id: "session-1",
			workspaceId: "ws-1",
		});
		const ep = createTestCodingAgentProcess({
			id: "ep-1",
			sessionId: "session-1",
			status: "completed",
		});

		const ctx = createMockContext({
			session: {
				list: () => ({ items: [session], nextCursor: null }),
			} as never,
			codingAgentProcess: {
				list: () => ({ items: [ep], nextCursor: null }),
			} as never,
		});

		const result = await getAttemptExecution({
			workspaceId: "ws-1",
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.workspaceId).toBe("ws-1");
			expect(result.value.sessionId).toBe("session-1");
			expect(result.value.executionProcessId).toBe("ep-1");
		}
	});
});
