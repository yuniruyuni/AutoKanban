import { describe, expect, test } from "bun:test";
import { Approval } from ".";

// ============================================
// Approval.create()
// ============================================

describe("Approval.create()", () => {
	test('creates with status "pending"', () => {
		const a = Approval.create({
			executionProcessId: "ep-1",
			toolName: "bash",
			toolCallId: "tc-1",
		});
		expect(a.status).toBe("pending");
	});

	test("generates a UUID id", () => {
		const a = Approval.create({
			executionProcessId: "ep-1",
			toolName: "bash",
			toolCallId: "tc-1",
		});
		expect(a.id).toMatch(/^[0-9a-f]{8}-/);
	});

	test("sets executionProcessId, toolName, and toolCallId", () => {
		const a = Approval.create({
			executionProcessId: "ep-1",
			toolName: "bash",
			toolCallId: "tc-1",
		});
		expect(a.executionProcessId).toBe("ep-1");
		expect(a.toolName).toBe("bash");
		expect(a.toolCallId).toBe("tc-1");
	});

	test("reason defaults to null", () => {
		const a = Approval.create({
			executionProcessId: "ep-1",
			toolName: "bash",
			toolCallId: "tc-1",
		});
		expect(a.reason).toBeNull();
	});

	test("respondedAt defaults to null", () => {
		const a = Approval.create({
			executionProcessId: "ep-1",
			toolName: "bash",
			toolCallId: "tc-1",
		});
		expect(a.respondedAt).toBeNull();
	});

	test("sets createdAt and updatedAt to the same time", () => {
		const a = Approval.create({
			executionProcessId: "ep-1",
			toolName: "bash",
			toolCallId: "tc-1",
		});
		expect(a.createdAt).toBeInstanceOf(Date);
		expect(a.createdAt).toEqual(a.updatedAt);
	});
});

// ============================================
// Approval.respond()
// ============================================

describe("Approval.respond()", () => {
	test("transitions to approved", () => {
		const a = Approval.create({
			executionProcessId: "ep-1",
			toolName: "bash",
			toolCallId: "tc-1",
		});
		const responded = Approval.respond(a, "approved", null);
		expect(responded.status).toBe("approved");
	});

	test("transitions to denied", () => {
		const a = Approval.create({
			executionProcessId: "ep-1",
			toolName: "bash",
			toolCallId: "tc-1",
		});
		const responded = Approval.respond(a, "denied", "not allowed");
		expect(responded.status).toBe("denied");
		expect(responded.reason).toBe("not allowed");
	});

	test("sets respondedAt", () => {
		const a = Approval.create({
			executionProcessId: "ep-1",
			toolName: "bash",
			toolCallId: "tc-1",
		});
		const responded = Approval.respond(a, "approved", null);
		expect(responded.respondedAt).toBeInstanceOf(Date);
	});

	test("preserves original fields", () => {
		const a = Approval.create({
			executionProcessId: "ep-1",
			toolName: "bash",
			toolCallId: "tc-1",
		});
		const responded = Approval.respond(a, "approved", null);
		expect(responded.id).toBe(a.id);
		expect(responded.executionProcessId).toBe("ep-1");
		expect(responded.toolName).toBe("bash");
		expect(responded.toolCallId).toBe("tc-1");
		expect(responded.createdAt).toEqual(a.createdAt);
	});

	test("updates updatedAt", () => {
		const a = Approval.create({
			executionProcessId: "ep-1",
			toolName: "bash",
			toolCallId: "tc-1",
		});
		const responded = Approval.respond(a, "approved", null);
		expect(responded.updatedAt.getTime()).toBeGreaterThanOrEqual(
			a.updatedAt.getTime(),
		);
	});
});

// ============================================
// Approval Specs
// ============================================

describe("Approval specs", () => {
	test("ById creates a spec", () => {
		const spec = Approval.ById("a-1");
		expect((spec as { type: string }).type).toBe("ById");
		expect((spec as { id: string }).id).toBe("a-1");
	});

	test("ByExecutionProcessId creates a spec", () => {
		const spec = Approval.ByExecutionProcessId("ep-1");
		expect((spec as { type: string }).type).toBe("ByExecutionProcessId");
		expect((spec as { executionProcessId: string }).executionProcessId).toBe(
			"ep-1",
		);
	});

	test("ByStatus creates a spec", () => {
		const spec = Approval.ByStatus("pending");
		expect((spec as { type: string }).type).toBe("ByStatus");
		expect((spec as { status: string }).status).toBe("pending");
	});
});

// ============================================
// Approval.cursor()
// ============================================

describe("Approval.cursor()", () => {
	const now = new Date("2025-01-15T10:00:00.000Z");
	const approval: Approval = {
		id: "approval-1",
		executionProcessId: "ep-1",
		toolName: "bash",
		toolCallId: "tc-1",
		status: "pending",
		reason: null,
		createdAt: now,
		respondedAt: null,
		updatedAt: now,
	};

	test("Date values are converted to ISO strings", () => {
		const cursor = Approval.cursor(approval, ["createdAt"]);
		expect(cursor.createdAt).toBe("2025-01-15T10:00:00.000Z");
	});

	test("String values are kept as strings", () => {
		const cursor = Approval.cursor(approval, ["id"]);
		expect(cursor.id).toBe("approval-1");
	});

	test("multiple keys produce multiple entries", () => {
		const cursor = Approval.cursor(approval, ["createdAt", "id"]);
		expect(cursor.createdAt).toBe("2025-01-15T10:00:00.000Z");
		expect(cursor.id).toBe("approval-1");
	});
});

// ============================================
// Approval constants
// ============================================

describe("Approval constants", () => {
	test("statuses contains all 3 statuses", () => {
		expect(Approval.statuses).toEqual(["pending", "approved", "denied"]);
	});

	test("defaultSort is desc by createdAt, id", () => {
		expect(Approval.defaultSort.keys).toEqual(["createdAt", "id"]);
		expect(Approval.defaultSort.order).toBe("desc");
	});
});
