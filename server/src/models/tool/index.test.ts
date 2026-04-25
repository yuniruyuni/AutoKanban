import { describe, expect, test } from "bun:test";
import { Tool } from ".";

// ============================================
// Tool.create()
// ============================================

describe("Tool.create()", () => {
	test("creates a tool with required fields", () => {
		const t = Tool.create({ name: "Lint", icon: "check", command: "bun lint" });
		expect(t.name).toBe("Lint");
		expect(t.icon).toBe("check");
		expect(t.command).toBe("bun lint");
	});

	test("generates a UUID id", () => {
		const t = Tool.create({ name: "t", icon: "i", command: "c" });
		expect(t.id).toMatch(/^[0-9a-f]{8}-/);
	});

	test("iconColor defaults to #6B7280", () => {
		const t = Tool.create({ name: "t", icon: "i", command: "c" });
		expect(t.iconColor).toBe("#6B7280");
	});

	test("iconColor can be set", () => {
		const t = Tool.create({
			name: "t",
			icon: "i",
			command: "c",
			iconColor: "#FF0000",
		});
		expect(t.iconColor).toBe("#FF0000");
	});

	test("sortOrder defaults to 0", () => {
		const t = Tool.create({ name: "t", icon: "i", command: "c" });
		expect(t.sortOrder).toBe(0);
	});

	test("sortOrder can be set", () => {
		const t = Tool.create({ name: "t", icon: "i", command: "c", sortOrder: 7 });
		expect(t.sortOrder).toBe(7);
	});

	test("sets createdAt and updatedAt", () => {
		const t = Tool.create({ name: "t", icon: "i", command: "c" });
		expect(t.createdAt).toBeInstanceOf(Date);
		expect(t.createdAt).toEqual(t.updatedAt);
	});
});

// ============================================
// Tool Specs
// ============================================

describe("Tool specs", () => {
	test("ById creates a spec", () => {
		const spec = Tool.ById("tool-1");
		expect((spec as { type: string }).type).toBe("ById");
		expect((spec as { id: string }).id).toBe("tool-1");
	});

	test("All creates a spec", () => {
		const spec = Tool.All();
		expect((spec as { type: string }).type).toBe("All");
	});
});

// ============================================
// Tool.cursor()
// ============================================

describe("Tool.cursor()", () => {
	const now = new Date("2025-01-15T10:00:00.000Z");
	const tool: Tool = {
		id: "tool-1",
		name: "Lint",
		icon: "check",
		iconColor: "#6B7280",
		command: "bun lint",
		argv: null,
		sortOrder: 2,
		createdAt: now,
		updatedAt: now,
	};

	test("Date values are converted to ISO strings", () => {
		const cursor = Tool.cursor(tool, ["createdAt"]);
		expect(cursor.createdAt).toBe("2025-01-15T10:00:00.000Z");
	});

	test("String values are kept as strings", () => {
		const cursor = Tool.cursor(tool, ["id"]);
		expect(cursor.id).toBe("tool-1");
	});

	test("Number values are converted to strings", () => {
		const cursor = Tool.cursor(tool, ["sortOrder"]);
		expect(cursor.sortOrder).toBe("2");
	});
});

// ============================================
// Tool.defaultSort
// ============================================

describe("Tool.defaultSort", () => {
	test("has expected keys and order", () => {
		expect(Tool.defaultSort.keys).toEqual(["sortOrder", "id"]);
		expect(Tool.defaultSort.order).toBe("asc");
	});
});
