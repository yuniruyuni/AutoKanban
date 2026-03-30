import { describe, expect, test } from "bun:test";
import { Variant } from ".";

// ============================================
// Variant.create()
// ============================================

describe("Variant.create()", () => {
	test("creates a variant with required fields", () => {
		const v = Variant.create({ executor: "claude-code", name: "default" });
		expect(v.executor).toBe("claude-code");
		expect(v.name).toBe("default");
	});

	test("generates a UUID id", () => {
		const v = Variant.create({ executor: "claude-code", name: "default" });
		expect(v.id).toMatch(/^[0-9a-f]{8}-/);
	});

	test("permissionMode defaults to bypassPermissions", () => {
		const v = Variant.create({ executor: "claude-code", name: "default" });
		expect(v.permissionMode).toBe("bypassPermissions");
	});

	test("permissionMode can be set", () => {
		const v = Variant.create({
			executor: "claude-code",
			name: "default",
			permissionMode: "ask",
		});
		expect(v.permissionMode).toBe("ask");
	});

	test("model defaults to null", () => {
		const v = Variant.create({ executor: "claude-code", name: "default" });
		expect(v.model).toBeNull();
	});

	test("model can be set", () => {
		const v = Variant.create({
			executor: "claude-code",
			name: "default",
			model: "opus",
		});
		expect(v.model).toBe("opus");
	});

	test("appendPrompt defaults to null", () => {
		const v = Variant.create({ executor: "claude-code", name: "default" });
		expect(v.appendPrompt).toBeNull();
	});

	test("appendPrompt can be set", () => {
		const v = Variant.create({
			executor: "claude-code",
			name: "default",
			appendPrompt: "Be concise",
		});
		expect(v.appendPrompt).toBe("Be concise");
	});

	test("sets createdAt and updatedAt", () => {
		const v = Variant.create({ executor: "claude-code", name: "default" });
		expect(v.createdAt).toBeInstanceOf(Date);
		expect(v.createdAt).toEqual(v.updatedAt);
	});
});

// ============================================
// Variant Specs
// ============================================

describe("Variant specs", () => {
	test("ById creates a spec", () => {
		const spec = Variant.ById("v-1");
		expect((spec as { type: string }).type).toBe("ById");
		expect((spec as { id: string }).id).toBe("v-1");
	});

	test("ByExecutor creates a spec", () => {
		const spec = Variant.ByExecutor("claude-code");
		expect((spec as { type: string }).type).toBe("ByExecutor");
		expect((spec as { executor: string }).executor).toBe("claude-code");
	});

	test("ByExecutorAndName creates a spec", () => {
		const spec = Variant.ByExecutorAndName("claude-code", "default");
		expect((spec as { type: string }).type).toBe("ByExecutorAndName");
		expect((spec as { executor: string }).executor).toBe("claude-code");
		expect((spec as { name: string }).name).toBe("default");
	});
});

// ============================================
// Variant.cursor()
// ============================================

describe("Variant.cursor()", () => {
	const now = new Date("2025-01-15T10:00:00.000Z");
	const variant: Variant = {
		id: "v-1",
		executor: "claude-code",
		name: "default",
		permissionMode: "bypassPermissions",
		model: null,
		appendPrompt: null,
		createdAt: now,
		updatedAt: now,
	};

	test("Date values are converted to ISO strings", () => {
		const cursor = Variant.cursor(variant, ["createdAt"]);
		expect(cursor.createdAt).toBe("2025-01-15T10:00:00.000Z");
	});

	test("String values are kept as strings", () => {
		const cursor = Variant.cursor(variant, ["id"]);
		expect(cursor.id).toBe("v-1");
	});
});

// ============================================
// Variant.defaultSort
// ============================================

describe("Variant.defaultSort", () => {
	test("has expected keys and order", () => {
		expect(Variant.defaultSort.keys).toEqual(["createdAt", "id"]);
		expect(Variant.defaultSort.order).toBe("asc");
	});
});
