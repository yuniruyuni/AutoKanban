import { describe, expect, test } from "bun:test";
import { TaskTemplate } from ".";

// ============================================
// TaskTemplate.create()
// ============================================

describe("TaskTemplate.create()", () => {
	test("creates a template with title", () => {
		const t = TaskTemplate.create({ title: "My Template" });
		expect(t.title).toBe("My Template");
	});

	test("generates a UUID id", () => {
		const t = TaskTemplate.create({ title: "t" });
		expect(t.id).toMatch(/^[0-9a-f]{8}-/);
	});

	test("description defaults to null", () => {
		const t = TaskTemplate.create({ title: "t" });
		expect(t.description).toBeNull();
	});

	test("description can be set", () => {
		const t = TaskTemplate.create({ title: "t", description: "desc" });
		expect(t.description).toBe("desc");
	});

	test("condition defaults to null", () => {
		const t = TaskTemplate.create({ title: "t" });
		expect(t.condition).toBeNull();
	});

	test("condition can be set", () => {
		const t = TaskTemplate.create({ title: "t", condition: "no_dev_server" });
		expect(t.condition).toBe("no_dev_server");
	});

	test("sortOrder defaults to 0", () => {
		const t = TaskTemplate.create({ title: "t" });
		expect(t.sortOrder).toBe(0);
	});

	test("sortOrder can be set", () => {
		const t = TaskTemplate.create({ title: "t", sortOrder: 5 });
		expect(t.sortOrder).toBe(5);
	});

	test("sets createdAt and updatedAt", () => {
		const t = TaskTemplate.create({ title: "t" });
		expect(t.createdAt).toBeInstanceOf(Date);
		expect(t.createdAt).toEqual(t.updatedAt);
	});
});

// ============================================
// TaskTemplate Specs
// ============================================

describe("TaskTemplate specs", () => {
	test("ById creates a spec", () => {
		const spec = TaskTemplate.ById("tt-1");
		expect((spec as { type: string }).type).toBe("ById");
		expect((spec as { id: string }).id).toBe("tt-1");
	});

	test("All creates a spec", () => {
		const spec = TaskTemplate.All();
		expect((spec as { type: string }).type).toBe("All");
	});
});

// ============================================
// TaskTemplate.cursor()
// ============================================

describe("TaskTemplate.cursor()", () => {
	const now = new Date("2025-01-15T10:00:00.000Z");
	const template: TaskTemplate = {
		id: "tt-1",
		title: "Test",
		description: null,
		condition: null,
		sortOrder: 3,
		createdAt: now,
		updatedAt: now,
	};

	test("Date values are converted to ISO strings", () => {
		const cursor = TaskTemplate.cursor(template, ["createdAt"]);
		expect(cursor.createdAt).toBe("2025-01-15T10:00:00.000Z");
	});

	test("String values are kept as strings", () => {
		const cursor = TaskTemplate.cursor(template, ["id"]);
		expect(cursor.id).toBe("tt-1");
	});

	test("Number values are converted to strings", () => {
		const cursor = TaskTemplate.cursor(template, ["sortOrder"]);
		expect(cursor.sortOrder).toBe("3");
	});
});

// ============================================
// TaskTemplate.defaultSort
// ============================================

describe("TaskTemplate.defaultSort", () => {
	test("has expected keys and order", () => {
		expect(TaskTemplate.defaultSort.keys).toEqual(["sortOrder", "id"]);
		expect(TaskTemplate.defaultSort.order).toBe("asc");
	});
});
