import { describe, expect, test } from "bun:test";
import { isCompLogical } from "./common";
import { Task } from "./task";

// ============================================
// Task.create()
// ============================================

describe("Task.create()", () => {
	test('creates a task with default status "todo"', () => {
		const task = Task.create({ projectId: "p1", title: "My Task" });
		expect(task.status).toBe("todo");
	});

	test("generates a UUID id", () => {
		const task = Task.create({ projectId: "p1", title: "My Task" });
		expect(task.id).toMatch(/^[0-9a-f]{8}-/);
	});

	test("sets projectId and title", () => {
		const task = Task.create({ projectId: "p1", title: "My Task" });
		expect(task.projectId).toBe("p1");
		expect(task.title).toBe("My Task");
	});

	test("description defaults to null when omitted", () => {
		const task = Task.create({ projectId: "p1", title: "My Task" });
		expect(task.description).toBeNull();
	});

	test("description is set when provided", () => {
		const task = Task.create({
			projectId: "p1",
			title: "My Task",
			description: "Details",
		});
		expect(task.description).toBe("Details");
	});

	test("description null is preserved", () => {
		const task = Task.create({
			projectId: "p1",
			title: "My Task",
			description: null,
		});
		expect(task.description).toBeNull();
	});

	test("sets createdAt and updatedAt to the same time", () => {
		const task = Task.create({ projectId: "p1", title: "My Task" });
		expect(task.createdAt).toEqual(task.updatedAt);
		expect(task.createdAt).toBeInstanceOf(Date);
	});
});

// ============================================
// Task.canTransition()
// ============================================

describe("Task.canTransition()", () => {
	// Allowed transitions
	test("todo → inprogress is allowed", () => {
		expect(Task.canTransition("todo", "inprogress")).toBe(true);
	});

	test("todo → cancelled is allowed", () => {
		expect(Task.canTransition("todo", "cancelled")).toBe(true);
	});

	test("inprogress → inreview is allowed", () => {
		expect(Task.canTransition("inprogress", "inreview")).toBe(true);
	});

	test("inprogress → todo is allowed", () => {
		expect(Task.canTransition("inprogress", "todo")).toBe(true);
	});

	test("inprogress → cancelled is allowed", () => {
		expect(Task.canTransition("inprogress", "cancelled")).toBe(true);
	});

	test("inreview → done is allowed", () => {
		expect(Task.canTransition("inreview", "done")).toBe(true);
	});

	test("inreview → inprogress is allowed", () => {
		expect(Task.canTransition("inreview", "inprogress")).toBe(true);
	});

	test("inreview → todo is allowed", () => {
		expect(Task.canTransition("inreview", "todo")).toBe(true);
	});

	test("inreview → cancelled is allowed", () => {
		expect(Task.canTransition("inreview", "cancelled")).toBe(true);
	});

	// Additional allowed transitions (all states reachable)
	test("todo → inreview is allowed", () => {
		expect(Task.canTransition("todo", "inreview")).toBe(true);
	});

	test("todo → done is allowed", () => {
		expect(Task.canTransition("todo", "done")).toBe(true);
	});

	test("inprogress → done is allowed", () => {
		expect(Task.canTransition("inprogress", "done")).toBe(true);
	});

	test("done → todo is allowed", () => {
		expect(Task.canTransition("done", "todo")).toBe(true);
	});

	test("done → inprogress is allowed", () => {
		expect(Task.canTransition("done", "inprogress")).toBe(true);
	});

	test("done → inreview is allowed", () => {
		expect(Task.canTransition("done", "inreview")).toBe(true);
	});

	test("done → cancelled is allowed", () => {
		expect(Task.canTransition("done", "cancelled")).toBe(true);
	});

	test("cancelled → todo is allowed", () => {
		expect(Task.canTransition("cancelled", "todo")).toBe(true);
	});

	test("cancelled → inprogress is allowed", () => {
		expect(Task.canTransition("cancelled", "inprogress")).toBe(true);
	});

	test("cancelled → inreview is allowed", () => {
		expect(Task.canTransition("cancelled", "inreview")).toBe(true);
	});

	test("cancelled → done is allowed", () => {
		expect(Task.canTransition("cancelled", "done")).toBe(true);
	});

	test("same status transition is not allowed", () => {
		expect(Task.canTransition("todo", "todo")).toBe(false);
		expect(Task.canTransition("inprogress", "inprogress")).toBe(false);
	});
});

// ============================================
// Task.getAllowedTransitions()
// ============================================

describe("Task.getAllowedTransitions()", () => {
	test("todo can transition to all other statuses", () => {
		expect(Task.getAllowedTransitions("todo")).toEqual([
			"inprogress",
			"inreview",
			"done",
			"cancelled",
		]);
	});

	test("inprogress can transition to all other statuses", () => {
		expect(Task.getAllowedTransitions("inprogress")).toEqual([
			"todo",
			"inreview",
			"done",
			"cancelled",
		]);
	});

	test("inreview can transition to all other statuses", () => {
		expect(Task.getAllowedTransitions("inreview")).toEqual([
			"todo",
			"inprogress",
			"done",
			"cancelled",
		]);
	});

	test("done can transition to all other statuses", () => {
		expect(Task.getAllowedTransitions("done")).toEqual([
			"todo",
			"inprogress",
			"inreview",
			"cancelled",
		]);
	});

	test("cancelled can transition to all other statuses", () => {
		expect(Task.getAllowedTransitions("cancelled")).toEqual([
			"todo",
			"inprogress",
			"inreview",
			"done",
		]);
	});
});

// ============================================
// Task.cursor()
// ============================================

describe("Task.cursor()", () => {
	const now = new Date("2025-01-15T10:00:00.000Z");
	const task: Task = {
		id: "task-1",
		projectId: "p1",
		title: "Test",
		description: null,
		status: "todo",
		createdAt: now,
		updatedAt: now,
	};

	test("Date values are converted to ISO strings", () => {
		const cursor = Task.cursor(task, ["createdAt"]);
		expect(cursor.createdAt).toBe("2025-01-15T10:00:00.000Z");
	});

	test("String values are kept as strings", () => {
		const cursor = Task.cursor(task, ["id"]);
		expect(cursor.id).toBe("task-1");
	});

	test("multiple keys produce multiple entries", () => {
		const cursor = Task.cursor(task, ["createdAt", "id"]);
		expect(cursor.createdAt).toBe("2025-01-15T10:00:00.000Z");
		expect(cursor.id).toBe("task-1");
	});
});

// ============================================
// Task Specs
// ============================================

describe("Task specs", () => {
	test("ById creates a spec with id", () => {
		const spec = Task.ById("abc");
		expect((spec as { type: string }).type).toBe("ById");
		expect((spec as { id: string }).id).toBe("abc");
	});

	test("ByProject creates a spec with projectId", () => {
		const spec = Task.ByProject("p1");
		expect((spec as { type: string }).type).toBe("ByProject");
		expect((spec as { projectId: string }).projectId).toBe("p1");
	});

	test("ByStatus creates a spec with status", () => {
		const spec = Task.ByStatus("todo");
		expect((spec as { type: string }).type).toBe("ByStatus");
		expect((spec as { status: string }).status).toBe("todo");
	});

	test("ByStatuses creates a spec with statuses array", () => {
		const spec = Task.ByStatuses("todo", "inprogress");
		expect((spec as { type: string }).type).toBe("ByStatuses");
		expect((spec as { statuses: string[] }).statuses).toEqual([
			"todo",
			"inprogress",
		]);
	});

	test("specs are composable", () => {
		const composed = Task.ByProject("p1").and(Task.ByStatus("todo"));
		expect(isCompLogical(composed)).toBe(true);
	});
});

// ============================================
// Task.statuses / Task.defaultSort
// ============================================

describe("Task constants", () => {
	test("statuses contains all 5 statuses", () => {
		expect(Task.statuses).toEqual([
			"todo",
			"inprogress",
			"inreview",
			"done",
			"cancelled",
		]);
	});

	test("defaultSort is desc by createdAt, id", () => {
		expect(Task.defaultSort.keys).toEqual(["createdAt", "id"]);
		expect(Task.defaultSort.order).toBe("desc");
	});
});
