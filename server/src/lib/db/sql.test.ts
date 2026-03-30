import { describe, expect, test } from "bun:test";
import { sql } from "./sql";

// ============================================
// sql tagged template literal
// ============================================

describe("sql tagged template", () => {
	test("creates a fragment with no values", () => {
		const frag = sql`SELECT * FROM tasks`;
		expect(frag.query).toBe("SELECT * FROM tasks");
		expect(frag.params).toEqual([]);
	});

	test("replaces values with ? placeholders", () => {
		const frag = sql`SELECT * FROM tasks WHERE id = ${42}`;
		expect(frag.query).toBe("SELECT * FROM tasks WHERE id = ?");
		expect(frag.params).toEqual([42]);
	});

	test("handles multiple values", () => {
		const frag = sql`SELECT * FROM tasks WHERE id = ${"abc"} AND status = ${"todo"}`;
		expect(frag.query).toBe("SELECT * FROM tasks WHERE id = ? AND status = ?");
		expect(frag.params).toEqual(["abc", "todo"]);
	});

	test("inlines nested fragments", () => {
		const inner = sql`status = ${"done"}`;
		const outer = sql`SELECT * FROM tasks WHERE ${inner}`;
		expect(outer.query).toBe("SELECT * FROM tasks WHERE status = ?");
		expect(outer.params).toEqual(["done"]);
	});

	test("collects params from nested fragments", () => {
		const inner1 = sql`id = ${"a"}`;
		const inner2 = sql`status = ${"todo"}`;
		const outer = sql`SELECT * FROM tasks WHERE ${inner1} AND ${inner2}`;
		expect(outer.query).toBe("SELECT * FROM tasks WHERE id = ? AND status = ?");
		expect(outer.params).toEqual(["a", "todo"]);
	});

	test("handles null and undefined values", () => {
		const frag = sql`INSERT INTO tasks (x, y) VALUES (${null}, ${undefined})`;
		expect(frag.query).toBe("INSERT INTO tasks (x, y) VALUES (?, ?)");
		expect(frag.params).toEqual([null, undefined]);
	});
});

// ============================================
// sql.join()
// ============================================

describe("sql.join()", () => {
	test("joins fragments with separator", () => {
		const fragments = [sql`a = ${1}`, sql`b = ${2}`];
		const joined = sql.join(fragments, " AND ");
		expect(joined.query).toBe("a = ? AND b = ?");
		expect(joined.params).toEqual([1, 2]);
	});

	test("returns empty for empty array", () => {
		const joined = sql.join([], " AND ");
		expect(joined.query).toBe("");
		expect(joined.params).toEqual([]);
	});

	test("handles single fragment", () => {
		const joined = sql.join([sql`x = ${5}`], " OR ");
		expect(joined.query).toBe("x = ?");
		expect(joined.params).toEqual([5]);
	});

	test("handles three fragments", () => {
		const joined = sql.join(
			[sql`a = ${1}`, sql`b = ${2}`, sql`c = ${3}`],
			", ",
		);
		expect(joined.query).toBe("a = ?, b = ?, c = ?");
		expect(joined.params).toEqual([1, 2, 3]);
	});
});

// ============================================
// sql.raw()
// ============================================

describe("sql.raw()", () => {
	test("creates a fragment with raw SQL", () => {
		const frag = sql.raw("ORDER BY created_at DESC");
		expect(frag.query).toBe("ORDER BY created_at DESC");
		expect(frag.params).toEqual([]);
	});

	test("raw fragments can be nested", () => {
		const order = sql.raw("ORDER BY id");
		const outer = sql`SELECT * FROM tasks ${order}`;
		expect(outer.query).toBe("SELECT * FROM tasks ORDER BY id");
		expect(outer.params).toEqual([]);
	});
});

// ============================================
// sql.list()
// ============================================

describe("sql.list()", () => {
	test("creates comma-separated placeholders", () => {
		const frag = sql.list([1, 2, 3]);
		expect(frag.query).toBe("?, ?, ?");
		expect(frag.params).toEqual([1, 2, 3]);
	});

	test("handles single value", () => {
		const frag = sql.list(["a"]);
		expect(frag.query).toBe("?");
		expect(frag.params).toEqual(["a"]);
	});

	test("handles empty array", () => {
		const frag = sql.list([]);
		expect(frag.query).toBe("");
		expect(frag.params).toEqual([]);
	});

	test("works in IN clause", () => {
		const frag = sql`SELECT * FROM tasks WHERE status IN (${sql.list(["todo", "done"])})`;
		expect(frag.query).toBe("SELECT * FROM tasks WHERE status IN (?, ?)");
		expect(frag.params).toEqual(["todo", "done"]);
	});
});

// ============================================
// sql.empty()
// ============================================

describe("sql.empty()", () => {
	test("returns 1=1 fragment", () => {
		const frag = sql.empty();
		expect(frag.query).toBe("1=1");
		expect(frag.params).toEqual([]);
	});

	test("can be used as WHERE clause", () => {
		const frag = sql`SELECT * FROM tasks WHERE ${sql.empty()}`;
		expect(frag.query).toBe("SELECT * FROM tasks WHERE 1=1");
	});
});
