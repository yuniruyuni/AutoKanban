import { describe, expect, test } from "bun:test";
import { and, type Comp, defineSpecs, not, or } from "../../models/common";
import { sql } from "./sql";
import { compToSQL, dateFromSQL, dateToSQL } from "./sql-helpers";

// ============================================
// Test helpers
// ============================================

type TestSpec = { type: "ById"; id: string } | { type: "ByName"; name: string };

const specs = defineSpecs({
	ById: (id: string) => ({ id }),
	ByName: (name: string) => ({ name }),
});

function testConverter(s: TestSpec) {
	switch (s.type) {
		case "ById":
			return sql`id = ${s.id}`;
		case "ByName":
			return sql`name = ${s.name}`;
	}
}

// ============================================
// compToSQL()
// ============================================

describe("compToSQL()", () => {
	test("leaf spec delegates to converter", () => {
		const result = compToSQL(
			specs.ById("abc"),
			testConverter as (s: unknown) => ReturnType<typeof testConverter>,
		);
		expect(result.query).toBe("id = ?");
		expect(result.params).toEqual(["abc"]);
	});

	test("AND of two specs", () => {
		const composed = specs
			.ById("1")
			.and(specs.ByName("test")) as Comp<TestSpec>;
		const result = compToSQL(
			composed,
			testConverter as (s: unknown) => ReturnType<typeof testConverter>,
		);
		expect(result.query).toBe("(id = ? AND name = ?)");
		expect(result.params).toEqual(["1", "test"]);
	});

	test("OR of two specs", () => {
		const composed = specs.ById("1").or(specs.ById("2")) as Comp<TestSpec>;
		const result = compToSQL(
			composed,
			testConverter as (s: unknown) => ReturnType<typeof testConverter>,
		);
		expect(result.query).toBe("(id = ? OR id = ?)");
		expect(result.params).toEqual(["1", "2"]);
	});

	test("NOT of a spec", () => {
		const composed = specs.ById("1").not() as Comp<TestSpec>;
		const result = compToSQL(
			composed,
			testConverter as (s: unknown) => ReturnType<typeof testConverter>,
		);
		expect(result.query).toBe("NOT (id = ?)");
		expect(result.params).toEqual(["1"]);
	});

	test("empty AND returns 1=1", () => {
		const composed = and() as Comp<TestSpec>;
		const result = compToSQL(
			composed,
			testConverter as (s: unknown) => ReturnType<typeof testConverter>,
		);
		expect(result.query).toBe("1=1");
	});

	test("empty OR returns 1=0", () => {
		const composed = or() as Comp<TestSpec>;
		const result = compToSQL(
			composed,
			testConverter as (s: unknown) => ReturnType<typeof testConverter>,
		);
		expect(result.query).toBe("1=0");
	});

	test("nested composition", () => {
		const composed = specs
			.ById("1")
			.and(specs.ByName("a").or(specs.ByName("b"))) as Comp<TestSpec>;
		const result = compToSQL(
			composed,
			testConverter as (s: unknown) => ReturnType<typeof testConverter>,
		);
		expect(result.query).toBe("(id = ? AND (name = ? OR name = ?))");
		expect(result.params).toEqual(["1", "a", "b"]);
	});

	test("collects all parameters", () => {
		const composed = and(
			specs.ById("x") as Comp<TestSpec>,
			specs.ByName("y") as Comp<TestSpec>,
			not(specs.ById("z") as Comp<TestSpec>),
		);
		const result = compToSQL(
			composed,
			testConverter as (s: unknown) => ReturnType<typeof testConverter>,
		);
		expect(result.params).toEqual(["x", "y", "z"]);
	});
});

// ============================================
// dateToSQL / dateFromSQL
// ============================================

describe("dateToSQL()", () => {
	test("converts Date to ISO string", () => {
		const date = new Date("2025-01-15T10:30:45.123Z");
		const result = dateToSQL(date);
		expect(result).toBe("2025-01-15T10:30:45.123Z");
	});

	test("returns ISO 8601 format with timezone", () => {
		const result = dateToSQL(new Date("2024-12-31T23:59:59.999Z"));
		expect(result).toContain("T");
		expect(result).toContain("Z");
	});
});

describe("dateFromSQL()", () => {
	test("converts SQL format back to Date", () => {
		const date = dateFromSQL("2025-01-15 10:30:45.123");
		expect(date).toBeInstanceOf(Date);
	});

	test("round-trip preserves value", () => {
		const original = new Date("2025-01-15T10:30:45.000Z");
		const sqlStr = dateToSQL(original);
		const restored = dateFromSQL(sqlStr);
		// Compare timestamps (may have ms difference in representation)
		expect(Math.abs(restored.getTime() - original.getTime())).toBeLessThan(
			1000,
		);
	});

	test("handles ISO format", () => {
		const date = dateFromSQL("2025-01-15T10:30:45.123Z");
		expect(date).toBeInstanceOf(Date);
		expect(date.getFullYear()).toBe(2025);
	});
});
