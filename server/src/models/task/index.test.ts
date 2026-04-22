import { describe, expect, test } from "bun:test";
import { isCompLogical, isFail } from "../common";
import { Task } from ".";

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
// Task.toInReview()
// ============================================

describe("Task.toInReview()", () => {
	test("transitions inprogress task to inreview", () => {
		const task = {
			...Task.create({ projectId: "p1", title: "T" }),
			status: "inprogress" as Task.Status,
		};
		const result = Task.toInReview(task);
		expect(result).not.toBeNull();
		expect(result?.status).toBe("inreview");
		expect(result?.updatedAt).toBeInstanceOf(Date);
	});

	test("returns null for non-inprogress task", () => {
		const task = Task.create({ projectId: "p1", title: "T" }); // status: "todo"
		expect(Task.toInReview(task)).toBeNull();
	});
});

// ============================================
// Task.restoreFromInReview()
// ============================================

describe("Task.restoreFromInReview()", () => {
	test("transitions inreview task to inprogress", () => {
		const task = {
			...Task.create({ projectId: "p1", title: "T" }),
			status: "inreview" as Task.Status,
		};
		const result = Task.restoreFromInReview(task);
		expect(result).not.toBeNull();
		expect(result?.status).toBe("inprogress");
	});

	test("returns null for non-inreview task", () => {
		const task = Task.create({ projectId: "p1", title: "T" });
		expect(Task.restoreFromInReview(task)).toBeNull();
	});
});

// ============================================
// Task.toDone()
// ============================================

describe("Task.toDone()", () => {
	test("transitions non-done task to done", () => {
		const task = {
			...Task.create({ projectId: "p1", title: "T" }),
			status: "inreview" as Task.Status,
		};
		const result = Task.toDone(task);
		expect(result).not.toBeNull();
		expect(result?.status).toBe("done");
		expect(result?.updatedAt).toBeInstanceOf(Date);
	});

	test("returns null for already-done task", () => {
		const task = {
			...Task.create({ projectId: "p1", title: "T" }),
			status: "done" as Task.Status,
		};
		expect(Task.toDone(task)).toBeNull();
	});
});

// ============================================
// Task.applyUpdate()
// ============================================

describe("Task.applyUpdate()", () => {
	const now = new Date("2025-01-15T10:00:00.000Z");
	const base: Task = {
		id: "task-1",
		projectId: "p1",
		title: "Original",
		description: "Desc",
		status: "todo",
		createdAt: new Date("2025-01-01T00:00:00.000Z"),
		updatedAt: new Date("2025-01-01T00:00:00.000Z"),
	};

	test("updates title when provided", () => {
		const result = Task.applyUpdate(base, { title: "New Title" }, now);
		expect(result.title).toBe("New Title");
		expect(result.description).toBe("Desc");
		expect(result.status).toBe("todo");
		expect(result.updatedAt).toEqual(now);
	});

	test("updates description when provided", () => {
		const result = Task.applyUpdate(base, { description: "New Desc" }, now);
		expect(result.description).toBe("New Desc");
	});

	test("sets description to null when explicitly null", () => {
		const result = Task.applyUpdate(base, { description: null }, now);
		expect(result.description).toBeNull();
	});

	test("preserves description when undefined", () => {
		const result = Task.applyUpdate(base, { title: "X" }, now);
		expect(result.description).toBe("Desc");
	});

	test("updates status when provided", () => {
		const result = Task.applyUpdate(base, { status: "inprogress" }, now);
		expect(result.status).toBe("inprogress");
	});

	test("preserves all fields when empty update", () => {
		const result = Task.applyUpdate(base, {}, now);
		expect(result.title).toBe("Original");
		expect(result.description).toBe("Desc");
		expect(result.status).toBe("todo");
		expect(result.updatedAt).toEqual(now);
	});
});

// ============================================
// Task.toPrompt()
// ============================================

describe("Task.toPrompt()", () => {
	test("returns title and description when description exists", () => {
		const task: Task = {
			id: "t1",
			projectId: "p1",
			title: "Fix bug",
			description: "Details here",
			status: "todo",
			createdAt: new Date(),
			updatedAt: new Date(),
		};
		expect(Task.toPrompt(task)).toBe("Fix bug\n\nDetails here");
	});

	test("returns only title when description is null", () => {
		const task: Task = {
			id: "t1",
			projectId: "p1",
			title: "Fix bug",
			description: null,
			status: "todo",
			createdAt: new Date(),
			updatedAt: new Date(),
		};
		expect(Task.toPrompt(task)).toBe("Fix bug");
	});

	test("returns only title when description is whitespace", () => {
		const task: Task = {
			id: "t1",
			projectId: "p1",
			title: "Fix bug",
			description: "   ",
			status: "todo",
			createdAt: new Date(),
			updatedAt: new Date(),
		};
		expect(Task.toPrompt(task)).toBe("Fix bug");
	});

	test("returns only title when description is empty string", () => {
		const task: Task = {
			id: "t1",
			projectId: "p1",
			title: "Fix bug",
			description: "",
			status: "todo",
			createdAt: new Date(),
			updatedAt: new Date(),
		};
		expect(Task.toPrompt(task)).toBe("Fix bug");
	});
});

// ============================================
// Task.toInProgress()
// ============================================

describe("Task.toInProgress()", () => {
	test("transitions non-inprogress task to inprogress", () => {
		const task = Task.create({ projectId: "p1", title: "T" });
		const result = Task.toInProgress(task);
		expect(result).not.toBeNull();
		expect(result?.status).toBe("inprogress");
		expect(result?.updatedAt).toBeInstanceOf(Date);
	});

	test("returns null for already-inprogress task", () => {
		const task = {
			...Task.create({ projectId: "p1", title: "T" }),
			status: "inprogress" as Task.Status,
		};
		expect(Task.toInProgress(task)).toBeNull();
	});
});

// ============================================
// Task.transitionEffects()
// ============================================

describe("Task.transitionEffects()", () => {
	test("shouldArchiveWorkspaces is true when transitioning to todo from other", () => {
		expect(
			Task.transitionEffects("inprogress", "todo").shouldArchiveWorkspaces,
		).toBe(true);
		expect(Task.transitionEffects("done", "todo").shouldArchiveWorkspaces).toBe(
			true,
		);
		expect(
			Task.transitionEffects("inreview", "todo").shouldArchiveWorkspaces,
		).toBe(true);
		expect(
			Task.transitionEffects("cancelled", "todo").shouldArchiveWorkspaces,
		).toBe(true);
	});

	test("shouldArchiveWorkspaces is false when already todo", () => {
		expect(Task.transitionEffects("todo", "todo").shouldArchiveWorkspaces).toBe(
			false,
		);
	});

	test("shouldArchiveWorkspaces is false for non-todo transitions", () => {
		expect(
			Task.transitionEffects("todo", "inprogress").shouldArchiveWorkspaces,
		).toBe(false);
		expect(
			Task.transitionEffects("inprogress", "done").shouldArchiveWorkspaces,
		).toBe(false);
	});
});

// ============================================
// Task.validateTransition()
// ============================================

describe("Task.validateTransition()", () => {
	test("returns valid result for allowed transition", () => {
		const result = Task.validateTransition("todo", "inprogress");
		expect(isFail(result)).toBe(false);
		if (!isFail(result)) {
			expect(result.valid).toBe(true);
			expect(result.effects.shouldArchiveWorkspaces).toBe(false);
		}
	});

	test("returns valid with shouldArchiveWorkspaces for transition to todo", () => {
		const result = Task.validateTransition("inprogress", "todo");
		expect(isFail(result)).toBe(false);
		if (!isFail(result)) {
			expect(result.valid).toBe(true);
			expect(result.effects.shouldArchiveWorkspaces).toBe(true);
		}
	});

	test("returns valid for same status transition", () => {
		const result = Task.validateTransition("todo", "todo");
		expect(isFail(result)).toBe(false);
		if (!isFail(result)) {
			expect(result.valid).toBe(true);
			expect(result.effects.shouldArchiveWorkspaces).toBe(false);
		}
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
