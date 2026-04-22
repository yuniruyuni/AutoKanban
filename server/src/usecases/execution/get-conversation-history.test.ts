import { describe, expect, test } from "bun:test";
import {
	createTestCodingAgentProcess,
	createTestSession,
} from "../../../test/factories";
import { createMockContext } from "../../../test/helpers/context";
import { getConversationHistory } from "./get-conversation-history";

describe("getConversationHistory", () => {
	test("returns empty turns when no coding agent processes exist", async () => {
		const session = createTestSession();

		const ctx = createMockContext({
			session: {
				get: () => session,
			} as never,
			codingAgentProcess: {
				list: () => ({ items: [], hasMore: false }),
			} as never,
		});

		const result = await getConversationHistory(session.id).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.sessionId).toBe(session.id);
			expect(result.value.turns).toHaveLength(0);
		}
	});

	test("returns NOT_FOUND when session does not exist", async () => {
		const ctx = createMockContext({
			session: {
				get: () => null,
			} as never,
		});

		const result = await getConversationHistory("non-existent").run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
			expect(result.error.message).toContain("Session not found");
		}
	});

	test("returns turns for coding agent processes", async () => {
		const session = createTestSession();
		const process1 = createTestCodingAgentProcess({
			sessionId: session.id,
			status: "completed",
		});
		const process2 = createTestCodingAgentProcess({
			sessionId: session.id,
			status: "running",
		});

		const turn1 = {
			id: "turn-1",
			executionProcessId: process1.id,
			prompt: "First prompt",
			summary: "First summary",
		};
		const turn2 = {
			id: "turn-2",
			executionProcessId: process2.id,
			prompt: "Second prompt",
			summary: null,
		};

		const ctx = createMockContext({
			session: {
				get: () => session,
			} as never,
			codingAgentProcess: {
				list: () => ({ items: [process1, process2], hasMore: false }),
			} as never,
			codingAgentTurn: {
				get: (spec: { executionProcessId?: string }) => {
					if (spec.executionProcessId === process1.id) return turn1;
					if (spec.executionProcessId === process2.id) return turn2;
					return null;
				},
			} as never,
		});

		const result = await getConversationHistory(session.id).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.turns).toHaveLength(2);
			expect(result.value.turns[0].prompt).toBe("First prompt");
			expect(result.value.turns[0].summary).toBe("First summary");
			expect(result.value.turns[0].status).toBe("completed");
			expect(result.value.turns[1].prompt).toBe("Second prompt");
			expect(result.value.turns[1].summary).toBeNull();
			expect(result.value.turns[1].status).toBe("running");
		}
	});

	test("all records in codingAgentProcess table are codingagent type", async () => {
		const session = createTestSession();
		const codingProcess = createTestCodingAgentProcess({
			sessionId: session.id,
			status: "completed",
		});

		const ctx = createMockContext({
			session: {
				get: () => session,
			} as never,
			codingAgentProcess: {
				list: () => ({
					items: [codingProcess],
					hasMore: false,
				}),
			} as never,
			codingAgentTurn: {
				get: () => ({
					id: "turn-1",
					executionProcessId: codingProcess.id,
					prompt: "Coding prompt",
					summary: "Coding summary",
				}),
			} as never,
		});

		const result = await getConversationHistory(session.id).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			// All records in the codingAgentProcess table are codingagent
			expect(result.value.turns).toHaveLength(1);
			expect(result.value.turns[0].prompt).toBe("Coding prompt");
		}
	});

	test("handles turns without coding agent turn record", async () => {
		const session = createTestSession();
		const process = createTestCodingAgentProcess({
			sessionId: session.id,
			status: "completed",
		});

		const ctx = createMockContext({
			session: {
				get: () => session,
			} as never,
			codingAgentProcess: {
				list: () => ({ items: [process], hasMore: false }),
			} as never,
			codingAgentTurn: {
				get: () => null, // No turn record
			} as never,
		});

		const result = await getConversationHistory(session.id).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.turns).toHaveLength(1);
			expect(result.value.turns[0].id).toBe(process.id); // Falls back to process.id
			expect(result.value.turns[0].prompt).toBeNull();
			expect(result.value.turns[0].summary).toBeNull();
		}
	});

	test("paginates through all coding agent processes", async () => {
		const session = createTestSession();
		const processes = Array.from({ length: 150 }, (_, _i) =>
			createTestCodingAgentProcess({
				sessionId: session.id,
				status: "completed",
			}),
		);

		let callCount = 0;

		const ctx = createMockContext({
			session: {
				get: () => session,
			} as never,
			codingAgentProcess: {
				list: (_spec: unknown, cursor: { limit: number; after?: unknown }) => {
					callCount++;
					const start = callCount === 1 ? 0 : 100;
					const items = processes.slice(start, start + cursor.limit);
					return {
						items,
						hasMore: callCount === 1,
						nextCursor: callCount === 1 ? { id: "cursor" } : undefined,
					};
				},
			} as never,
			codingAgentTurn: {
				get: (spec: { executionProcessId?: string }) => ({
					id: `turn-${spec.executionProcessId}`,
					executionProcessId: spec.executionProcessId,
					prompt: `Prompt ${spec.executionProcessId}`,
					summary: null,
				}),
			} as never,
		});

		const result = await getConversationHistory(session.id).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.turns.length).toBe(150);
		}
		expect(callCount).toBe(2); // Two pages
	});
});
