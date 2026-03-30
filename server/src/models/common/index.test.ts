import { describe, expect, test } from "bun:test";
import {
	and,
	defineSpecs,
	FAIL_BRAND,
	fail,
	generateId,
	isCompLogical,
	isFail,
	not,
	or,
} from ".";

// ============================================
// fail / isFail
// ============================================

describe("fail()", () => {
	test("creates a Fail object with code and message", () => {
		const f = fail("NOT_FOUND", "Item not found");
		expect(f.code).toBe("NOT_FOUND");
		expect(f.message).toBe("Item not found");
		expect(f[FAIL_BRAND]).toBe(true);
	});

	test("creates a Fail object with details", () => {
		const f = fail("INVALID_INPUT", "Bad input", { field: "name" });
		expect(f.details).toEqual({ field: "name" });
	});

	test("details is undefined when not provided", () => {
		const f = fail("INTERNAL", "Error");
		expect(f.details).toBeUndefined();
	});
});

describe("isFail()", () => {
	test("returns true for Fail objects", () => {
		expect(isFail(fail("X", "x"))).toBe(true);
	});

	test("returns false for null", () => {
		expect(isFail(null)).toBe(false);
	});

	test("returns false for undefined", () => {
		expect(isFail(undefined)).toBe(false);
	});

	test("returns false for plain objects", () => {
		expect(isFail({ code: "X", message: "x" })).toBe(false);
	});

	test("returns false for primitives", () => {
		expect(isFail("string")).toBe(false);
		expect(isFail(42)).toBe(false);
	});
});

// ============================================
// generateId
// ============================================

describe("generateId()", () => {
	test("returns a UUID string", () => {
		const id = generateId();
		expect(id).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
		);
	});

	test("generates unique IDs", () => {
		const ids = new Set(Array.from({ length: 100 }, () => generateId()));
		expect(ids.size).toBe(100);
	});
});

// ============================================
// defineSpecs
// ============================================

describe("defineSpecs()", () => {
	const specs = defineSpecs({
		ById: (id: string) => ({ type: "ById" as const, id }),
		ByName: (name: string) => ({ type: "ByName" as const, name }),
	});

	test("creates spec factory functions", () => {
		const spec = specs.ById("abc");
		expect((spec as { type: string }).type).toBe("ById");
		expect((spec as { id: string }).id).toBe("abc");
	});

	test("specs have CompMethods (.and, .or, .not)", () => {
		const spec = specs.ById("abc");
		expect(typeof spec.and).toBe("function");
		expect(typeof spec.or).toBe("function");
		expect(typeof spec.not).toBe("function");
	});
});

// ============================================
// Comp composition (.and, .or, .not)
// ============================================

describe("Comp composition", () => {
	const specs = defineSpecs({
		ById: (id: string) => ({ type: "ById" as const, id }),
		ByName: (name: string) => ({ type: "ByName" as const, name }),
	});

	test(".and() creates AND composition", () => {
		const composed = specs.ById("1").and(specs.ByName("test"));
		expect(isCompLogical(composed)).toBe(true);
		expect((composed as { type: string }).type).toBe("and");
		expect((composed as { children: unknown[] }).children).toHaveLength(2);
	});

	test(".or() creates OR composition", () => {
		const composed = specs.ById("1").or(specs.ById("2"));
		expect(isCompLogical(composed)).toBe(true);
		expect((composed as { type: string }).type).toBe("or");
		expect((composed as { children: unknown[] }).children).toHaveLength(2);
	});

	test(".not() creates NOT composition", () => {
		const composed = specs.ById("1").not();
		expect(isCompLogical(composed)).toBe(true);
		expect((composed as { type: string }).type).toBe("not");
		expect((composed as { child: unknown }).child).toBeDefined();
	});

	test("compositions are chainable", () => {
		const composed = specs.ById("1").and(specs.ByName("test")).not();
		expect(isCompLogical(composed)).toBe(true);
		expect((composed as { type: string }).type).toBe("not");
	});
});

// ============================================
// isCompLogical
// ============================================

describe("isCompLogical()", () => {
	const specs = defineSpecs({
		ById: (id: string) => ({ type: "ById" as const, id }),
	});

	test("returns true for AND", () => {
		const composed = and(specs.ById("1"), specs.ById("2"));
		expect(isCompLogical(composed)).toBe(true);
	});

	test("returns true for OR", () => {
		const composed = or(specs.ById("1"), specs.ById("2"));
		expect(isCompLogical(composed)).toBe(true);
	});

	test("returns true for NOT", () => {
		const composed = not(specs.ById("1"));
		expect(isCompLogical(composed)).toBe(true);
	});

	test("returns false for leaf spec", () => {
		const spec = specs.ById("1");
		expect(isCompLogical(spec)).toBe(false);
	});
});

// ============================================
// Top-level and/or/not
// ============================================

describe("and()", () => {
	const specs = defineSpecs({
		ById: (id: string) => ({ type: "ById" as const, id }),
	});

	test("creates AND with multiple children", () => {
		const composed = and(specs.ById("1"), specs.ById("2"), specs.ById("3"));
		expect((composed as { type: string }).type).toBe("and");
		expect((composed as { children: unknown[] }).children).toHaveLength(3);
	});

	test("result has CompMethods", () => {
		const composed = and(specs.ById("1"), specs.ById("2"));
		expect(typeof composed.and).toBe("function");
		expect(typeof composed.or).toBe("function");
		expect(typeof composed.not).toBe("function");
	});
});

describe("or()", () => {
	const specs = defineSpecs({
		ById: (id: string) => ({ type: "ById" as const, id }),
	});

	test("creates OR with multiple children", () => {
		const composed = or(specs.ById("1"), specs.ById("2"));
		expect((composed as { type: string }).type).toBe("or");
		expect((composed as { children: unknown[] }).children).toHaveLength(2);
	});
});

describe("not()", () => {
	const specs = defineSpecs({
		ById: (id: string) => ({ type: "ById" as const, id }),
	});

	test("creates NOT wrapper", () => {
		const composed = not(specs.ById("1"));
		expect((composed as { type: string }).type).toBe("not");
	});
});
