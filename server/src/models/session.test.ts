import { describe, expect, test } from "bun:test";
import { Session } from "./session";

// ============================================
// Session.create()
// ============================================

describe("Session.create()", () => {
	test("creates a session with workspaceId", () => {
		const session = Session.create({ workspaceId: "ws-1" });
		expect(session.workspaceId).toBe("ws-1");
	});

	test("generates a UUID id", () => {
		const session = Session.create({ workspaceId: "ws-1" });
		expect(session.id).toMatch(/^[0-9a-f]{8}-/);
	});

	test("executor defaults to null", () => {
		const session = Session.create({ workspaceId: "ws-1" });
		expect(session.executor).toBeNull();
	});

	test("executor can be set", () => {
		const session = Session.create({
			workspaceId: "ws-1",
			executor: "claude-code",
		});
		expect(session.executor).toBe("claude-code");
	});

	test("variant defaults to null", () => {
		const session = Session.create({ workspaceId: "ws-1" });
		expect(session.variant).toBeNull();
	});

	test("variant can be set", () => {
		const session = Session.create({
			workspaceId: "ws-1",
			variant: "protocol",
		});
		expect(session.variant).toBe("protocol");
	});

	test("sets createdAt and updatedAt", () => {
		const session = Session.create({ workspaceId: "ws-1" });
		expect(session.createdAt).toBeInstanceOf(Date);
		expect(session.createdAt).toEqual(session.updatedAt);
	});
});

// ============================================
// Session Specs
// ============================================

describe("Session specs", () => {
	test("ById creates a spec", () => {
		const spec = Session.ById("s1");
		expect((spec as { type: string }).type).toBe("ById");
		expect((spec as { id: string }).id).toBe("s1");
	});

	test("ByWorkspaceId creates a spec", () => {
		const spec = Session.ByWorkspaceId("ws-1");
		expect((spec as { type: string }).type).toBe("ByWorkspaceId");
		expect((spec as { workspaceId: string }).workspaceId).toBe("ws-1");
	});
});

// ============================================
// Session.cursor()
// ============================================

describe("Session.cursor()", () => {
	const now = new Date("2025-01-15T10:00:00.000Z");
	const session: Session = {
		id: "sess-1",
		workspaceId: "ws-1",
		executor: null,
		variant: null,
		createdAt: now,
		updatedAt: now,
	};

	test("Date values are converted to ISO strings", () => {
		const cursor = Session.cursor(session, ["createdAt"]);
		expect(cursor.createdAt).toBe("2025-01-15T10:00:00.000Z");
	});

	test("String values are kept as strings", () => {
		const cursor = Session.cursor(session, ["id"]);
		expect(cursor.id).toBe("sess-1");
	});
});
