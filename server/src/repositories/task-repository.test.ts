import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createTestProject, createTestTask } from "../../test/factories";
import { closeTestDB, createTestDB } from "../../test/helpers/db";
import { expectEntityEqual } from "../../test/helpers/entity-equality";
import type { PgDatabase } from "../db/pg-client";
import { and } from "../models/common";
import { Task } from "../models/task";
import { ProjectRepository } from "./project";
import { TaskRepository } from "./task";

let db: PgDatabase;
let taskRepo: TaskRepository;
let projectRepo: ProjectRepository;
const PROJECT_ID = "test-project-1";

beforeEach(async () => {
	db = await createTestDB();
	taskRepo = new TaskRepository(db);
	projectRepo = new ProjectRepository(db);
	// Insert a project so FK constraints are satisfied
	const project = createTestProject({
		id: PROJECT_ID,
		repoPath: `/tmp/repo-${Date.now()}`,
	});
	await projectRepo.upsert(project);
});

afterEach(async () => {
	await closeTestDB(db);
});

// ============================================
// upsert + get
// ============================================

describe("TaskRepository upsert + get", () => {
	test("inserts and retrieves a task", async () => {
		const task = createTestTask({ projectId: PROJECT_ID });
		await taskRepo.upsert(task);

		const retrieved = await taskRepo.get(Task.ById(task.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.id).toBe(task.id);
		expect(retrieved?.title).toBe(task.title);
		expect(retrieved?.status).toBe("todo");
	});

	test("updates existing task on conflict", async () => {
		const task = createTestTask({ projectId: PROJECT_ID });
		await taskRepo.upsert(task);

		const updated = { ...task, title: "Updated Title", updatedAt: new Date() };
		await taskRepo.upsert(updated);

		const retrieved = await taskRepo.get(Task.ById(task.id));
		expect(retrieved?.title).toBe("Updated Title");
	});

	test("preserves null description", async () => {
		const task = createTestTask({ projectId: PROJECT_ID, description: null });
		await taskRepo.upsert(task);

		const retrieved = await taskRepo.get(Task.ById(task.id));
		expect(retrieved?.description).toBeNull();
	});

	test("stores and retrieves description", async () => {
		const task = createTestTask({
			projectId: PROJECT_ID,
			description: "Some details",
		});
		await taskRepo.upsert(task);

		const retrieved = await taskRepo.get(Task.ById(task.id));
		expect(retrieved?.description).toBe("Some details");
	});

	test("returns null for non-existent id", async () => {
		const retrieved = await taskRepo.get(Task.ById("non-existent"));
		expect(retrieved).toBeNull();
	});

	test("P1: round-trip preserves all fields", async () => {
		const task = createTestTask({
			projectId: PROJECT_ID,
			title: "Full round-trip",
			description: "Detailed desc",
			status: "inprogress",
		});
		await taskRepo.upsert(task);

		const retrieved = await taskRepo.get(Task.ById(task.id));
		expect(retrieved).not.toBeNull();
		expectEntityEqual(retrieved as Task, task, ["createdAt", "updatedAt"]);
	});

	test("P2: update round-trip reflects all changed fields", async () => {
		const task = createTestTask({ projectId: PROJECT_ID });
		await taskRepo.upsert(task);

		const updated: Task = {
			...task,
			title: "New Title",
			description: "New description",
			status: "inprogress",
			updatedAt: new Date(),
		};
		await taskRepo.upsert(updated);

		const retrieved = await taskRepo.get(Task.ById(task.id));
		expect(retrieved).not.toBeNull();
		expectEntityEqual(retrieved as Task, updated, ["createdAt", "updatedAt"]);
	});

	test("P1: round-trip with null description", async () => {
		const task = createTestTask({ projectId: PROJECT_ID, description: null });
		await taskRepo.upsert(task);

		const retrieved = await taskRepo.get(Task.ById(task.id));
		expect(retrieved).not.toBeNull();
		expectEntityEqual(retrieved as Task, task, ["createdAt", "updatedAt"]);
	});
});

// ============================================
// Spec-based get/list
// ============================================

describe("TaskRepository spec queries", () => {
	test("ByProject filters by project", async () => {
		const task1 = createTestTask({ projectId: PROJECT_ID });
		await taskRepo.upsert(task1);

		const page = await taskRepo.list(Task.ByProject(PROJECT_ID), {
			limit: 50,
		});
		expect(page.items).toHaveLength(1);
		expect(page.items[0].id).toBe(task1.id);
	});

	test("ByStatus filters by status", async () => {
		const task1 = createTestTask({ projectId: PROJECT_ID, status: "todo" });
		const task2 = createTestTask({
			projectId: PROJECT_ID,
			status: "inprogress",
		});
		await taskRepo.upsert(task1);
		await taskRepo.upsert(task2);

		const page = await taskRepo.list(Task.ByStatus("todo"), { limit: 50 });
		expect(page.items).toHaveLength(1);
		expect(page.items[0].status).toBe("todo");
	});

	test("ByStatuses filters by multiple statuses", async () => {
		const task1 = createTestTask({ projectId: PROJECT_ID, status: "todo" });
		const task2 = createTestTask({
			projectId: PROJECT_ID,
			status: "inprogress",
		});
		const task3 = createTestTask({ projectId: PROJECT_ID, status: "done" });
		await taskRepo.upsert(task1);
		await taskRepo.upsert(task2);
		await taskRepo.upsert(task3);

		const page = await taskRepo.list(Task.ByStatuses("todo", "inprogress"), {
			limit: 50,
		});
		expect(page.items).toHaveLength(2);
	});

	test("AND composition filters correctly", async () => {
		const task1 = createTestTask({ projectId: PROJECT_ID, status: "todo" });
		const task2 = createTestTask({
			projectId: PROJECT_ID,
			status: "inprogress",
		});
		await taskRepo.upsert(task1);
		await taskRepo.upsert(task2);

		const spec = and(
			Task.ByProject(PROJECT_ID),
			Task.ByStatus("todo"),
		) as Task.Spec;
		const page = await taskRepo.list(spec, { limit: 50 });
		expect(page.items).toHaveLength(1);
		expect(page.items[0].status).toBe("todo");
	});
});

// ============================================
// Pagination
// ============================================

describe("TaskRepository pagination", () => {
	test("respects limit", async () => {
		for (let i = 0; i < 5; i++) {
			const task = createTestTask({ projectId: PROJECT_ID });
			await taskRepo.upsert(task);
		}

		const page = await taskRepo.list(Task.ByProject(PROJECT_ID), {
			limit: 3,
		});
		expect(page.items).toHaveLength(3);
		expect(page.hasMore).toBe(true);
		expect(page.nextCursor).toBeDefined();
	});

	test("hasMore is false when all items fit", async () => {
		for (let i = 0; i < 3; i++) {
			const task = createTestTask({ projectId: PROJECT_ID });
			await taskRepo.upsert(task);
		}

		const page = await taskRepo.list(Task.ByProject(PROJECT_ID), {
			limit: 10,
		});
		expect(page.items).toHaveLength(3);
		expect(page.hasMore).toBe(false);
		expect(page.nextCursor).toBeUndefined();
	});

	test("empty result returns empty items", async () => {
		const page = await taskRepo.list(Task.ByProject("non-existent"), {
			limit: 10,
		});
		expect(page.items).toHaveLength(0);
		expect(page.hasMore).toBe(false);
	});

	test("sort order desc is default", async () => {
		const task1 = createTestTask({
			projectId: PROJECT_ID,
			createdAt: new Date("2025-01-01"),
		});
		const task2 = createTestTask({
			projectId: PROJECT_ID,
			createdAt: new Date("2025-01-02"),
		});
		await taskRepo.upsert(task1);
		await taskRepo.upsert(task2);

		const page = await taskRepo.list(Task.ByProject(PROJECT_ID), {
			limit: 10,
			sort: { keys: ["createdAt", "id"] as const, order: "desc" },
		});
		// task2 (newer) should come first
		expect(page.items[0].id).toBe(task2.id);
	});
});

// ============================================
// delete + count
// ============================================

describe("TaskRepository delete + count", () => {
	test("deletes a task", async () => {
		const task = createTestTask({ projectId: PROJECT_ID });
		await taskRepo.upsert(task);

		const deleted = await taskRepo.delete(Task.ById(task.id));
		expect(deleted).toBe(1);
		expect(await taskRepo.get(Task.ById(task.id))).toBeNull();
	});

	test("returns 0 when nothing to delete", async () => {
		const deleted = await taskRepo.delete(Task.ById("non-existent"));
		expect(deleted).toBe(0);
	});

	test("counts tasks matching spec", async () => {
		const task1 = createTestTask({ projectId: PROJECT_ID, status: "todo" });
		const task2 = createTestTask({ projectId: PROJECT_ID, status: "todo" });
		const task3 = createTestTask({ projectId: PROJECT_ID, status: "done" });
		await taskRepo.upsert(task1);
		await taskRepo.upsert(task2);
		await taskRepo.upsert(task3);

		expect(await taskRepo.count(Task.ByStatus("todo"))).toBe(2);
		expect(await taskRepo.count(Task.ByStatus("done"))).toBe(1);
		expect(await taskRepo.count(Task.ByStatus("cancelled"))).toBe(0);
	});

	test("count returns 0 for empty", async () => {
		expect(await taskRepo.count(Task.ByProject(PROJECT_ID))).toBe(0);
	});
});
