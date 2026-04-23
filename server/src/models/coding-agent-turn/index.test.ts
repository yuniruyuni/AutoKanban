import { describe, expect, test } from "bun:test";
import { CodingAgentTurn } from ".";

// ============================================
// CodingAgentTurn.create()
// ============================================

describe("CodingAgentTurn.create()", () => {
	test("generates a UUID id", () => {
		const turn = CodingAgentTurn.create({ executionProcessId: "ep-1" });
		expect(turn.id).toMatch(/^[0-9a-f]{8}-/);
	});

	test("sets executionProcessId", () => {
		const turn = CodingAgentTurn.create({ executionProcessId: "ep-1" });
		expect(turn.executionProcessId).toBe("ep-1");
	});

	test("agentSessionId defaults to null", () => {
		const turn = CodingAgentTurn.create({ executionProcessId: "ep-1" });
		expect(turn.agentSessionId).toBeNull();
	});

	test("agentMessageId defaults to null", () => {
		const turn = CodingAgentTurn.create({ executionProcessId: "ep-1" });
		expect(turn.agentMessageId).toBeNull();
	});

	test("prompt defaults to null when omitted", () => {
		const turn = CodingAgentTurn.create({ executionProcessId: "ep-1" });
		expect(turn.prompt).toBeNull();
	});

	test("prompt can be set", () => {
		const turn = CodingAgentTurn.create({
			executionProcessId: "ep-1",
			prompt: "fix the bug",
		});
		expect(turn.prompt).toBe("fix the bug");
	});

	test("summary defaults to null", () => {
		const turn = CodingAgentTurn.create({ executionProcessId: "ep-1" });
		expect(turn.summary).toBeNull();
	});

	test("seen defaults to false", () => {
		const turn = CodingAgentTurn.create({ executionProcessId: "ep-1" });
		expect(turn.seen).toBe(false);
	});

	test("sets createdAt and updatedAt to the same Date", () => {
		const turn = CodingAgentTurn.create({ executionProcessId: "ep-1" });
		expect(turn.createdAt).toBeInstanceOf(Date);
		expect(turn.createdAt).toEqual(turn.updatedAt);
	});
});

// ============================================
// CodingAgentTurn.withAgentSessionId()
// ============================================

describe("CodingAgentTurn.withAgentSessionId()", () => {
	test("updates agentSessionId", () => {
		const turn = CodingAgentTurn.create({ executionProcessId: "ep-1" });
		const updated = CodingAgentTurn.withAgentSessionId(turn, "session-123");
		expect(updated.agentSessionId).toBe("session-123");
	});

	test("preserves other fields", () => {
		const turn = CodingAgentTurn.create({
			executionProcessId: "ep-1",
			prompt: "test prompt",
		});
		const updated = CodingAgentTurn.withAgentSessionId(turn, "session-123");
		expect(updated.id).toBe(turn.id);
		expect(updated.executionProcessId).toBe("ep-1");
		expect(updated.prompt).toBe("test prompt");
		expect(updated.summary).toBeNull();
	});

	test("updates updatedAt", () => {
		const turn = CodingAgentTurn.create({ executionProcessId: "ep-1" });
		const updated = CodingAgentTurn.withAgentSessionId(turn, "session-123");
		expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
			turn.updatedAt.getTime(),
		);
	});

	test("does not mutate original", () => {
		const turn = CodingAgentTurn.create({ executionProcessId: "ep-1" });
		CodingAgentTurn.withAgentSessionId(turn, "session-123");
		expect(turn.agentSessionId).toBeNull();
	});
});

// ============================================
// CodingAgentTurn.withAgentMessageId()
// ============================================

describe("CodingAgentTurn.withAgentMessageId()", () => {
	test("updates agentMessageId", () => {
		const turn = CodingAgentTurn.create({ executionProcessId: "ep-1" });
		const updated = CodingAgentTurn.withAgentMessageId(turn, "msg-456");
		expect(updated.agentMessageId).toBe("msg-456");
	});

	test("preserves other fields", () => {
		const turn = CodingAgentTurn.create({ executionProcessId: "ep-1" });
		const updated = CodingAgentTurn.withAgentMessageId(turn, "msg-456");
		expect(updated.id).toBe(turn.id);
		expect(updated.executionProcessId).toBe("ep-1");
		expect(updated.agentSessionId).toBeNull();
	});

	test("updates updatedAt", () => {
		const turn = CodingAgentTurn.create({ executionProcessId: "ep-1" });
		const updated = CodingAgentTurn.withAgentMessageId(turn, "msg-456");
		expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
			turn.updatedAt.getTime(),
		);
	});

	test("does not mutate original", () => {
		const turn = CodingAgentTurn.create({ executionProcessId: "ep-1" });
		CodingAgentTurn.withAgentMessageId(turn, "msg-456");
		expect(turn.agentMessageId).toBeNull();
	});
});

// ============================================
// CodingAgentTurn.withSummary()
// ============================================

describe("CodingAgentTurn.withSummary()", () => {
	test("updates summary", () => {
		const turn = CodingAgentTurn.create({ executionProcessId: "ep-1" });
		const updated = CodingAgentTurn.withSummary(turn, "Task completed");
		expect(updated.summary).toBe("Task completed");
	});

	test("preserves other fields", () => {
		const turn = CodingAgentTurn.create({
			executionProcessId: "ep-1",
			prompt: "fix bug",
		});
		const updated = CodingAgentTurn.withSummary(turn, "Fixed the bug");
		expect(updated.id).toBe(turn.id);
		expect(updated.executionProcessId).toBe("ep-1");
		expect(updated.prompt).toBe("fix bug");
	});

	test("updates updatedAt", () => {
		const turn = CodingAgentTurn.create({ executionProcessId: "ep-1" });
		const updated = CodingAgentTurn.withSummary(turn, "Task completed");
		expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
			turn.updatedAt.getTime(),
		);
	});

	test("does not mutate original", () => {
		const turn = CodingAgentTurn.create({ executionProcessId: "ep-1" });
		CodingAgentTurn.withSummary(turn, "Task completed");
		expect(turn.summary).toBeNull();
	});
});

// ============================================
// CodingAgentTurn Specs
// ============================================

describe("CodingAgentTurn specs", () => {
	test("ById creates a spec", () => {
		const spec = CodingAgentTurn.ById("t1");
		expect((spec as { type: string }).type).toBe("ById");
		expect((spec as { id: string }).id).toBe("t1");
	});

	test("ByExecutionProcessId creates a spec", () => {
		const spec = CodingAgentTurn.ByExecutionProcessId("ep-1");
		expect((spec as { type: string }).type).toBe("ByExecutionProcessId");
		expect((spec as { executionProcessId: string }).executionProcessId).toBe(
			"ep-1",
		);
	});

	test("ByAgentSessionId creates a spec", () => {
		const spec = CodingAgentTurn.ByAgentSessionId("as-1");
		expect((spec as { type: string }).type).toBe("ByAgentSessionId");
		expect((spec as { agentSessionId: string }).agentSessionId).toBe("as-1");
	});

	test("HasAgentSessionId creates a spec", () => {
		const spec = CodingAgentTurn.HasAgentSessionId();
		expect((spec as { type: string }).type).toBe("HasAgentSessionId");
	});
});

// ============================================
// CodingAgentTurn.cursor()
// ============================================

describe("CodingAgentTurn.cursor()", () => {
	const now = new Date("2025-01-15T10:00:00.000Z");
	const turn: CodingAgentTurn = {
		id: "turn-1",
		executionProcessId: "ep-1",
		agentSessionId: null,
		agentMessageId: null,
		prompt: null,
		summary: null,
		seen: false,
		createdAt: now,
		updatedAt: now,
	};

	test("Date values are converted to ISO strings", () => {
		const cursor = CodingAgentTurn.cursor(turn, ["createdAt"]);
		expect(cursor.createdAt).toBe("2025-01-15T10:00:00.000Z");
	});

	test("String values are kept as strings", () => {
		const cursor = CodingAgentTurn.cursor(turn, ["id"]);
		expect(cursor.id).toBe("turn-1");
	});

	test("multiple keys are returned together", () => {
		const cursor = CodingAgentTurn.cursor(turn, ["createdAt", "id"]);
		expect(cursor.createdAt).toBe("2025-01-15T10:00:00.000Z");
		expect(cursor.id).toBe("turn-1");
	});
});

// ============================================
// CodingAgentTurn.defaultSort
// ============================================

describe("CodingAgentTurn.defaultSort", () => {
	test("sorts by createdAt and id descending", () => {
		expect(CodingAgentTurn.defaultSort).toEqual({
			keys: ["createdAt", "id"],
			order: "desc",
		});
	});
});
