import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	createTestProject,
	createTestTask,
	createTestWorkspace,
} from "../../test/factories";
import { closeTestDB, createTestDB } from "../../test/helpers/db";
import { expectEntityEqual } from "../../test/helpers/entity-equality";
import type { PgDatabase } from "../db/pg-client";
import { Workspace } from "../models/workspace";
import { ProjectRepository } from "./project";
import { TaskRepository } from "./task";
import { WorkspaceRepository } from "./workspace";

let db: PgDatabase;
let workspaceRepo: WorkspaceRepository;
let TASK_ID: string;

beforeEach(async () => {
	db = await createTestDB();
	workspaceRepo = new WorkspaceRepository(db);

	// FK chain: project → task
	const project = createTestProject();
	await new ProjectRepository(db).upsert(project);
	const task = createTestTask({ projectId: project.id });
	await new TaskRepository(db).upsert(task);
	TASK_ID = task.id;
});

afterEach(async () => {
	await closeTestDB(db);
});

// ============================================
// P1: Round-trip
// ============================================

describe("WorkspaceRepository round-trip", () => {
	test("preserves all fields", async () => {
		const ws = createTestWorkspace({
			taskId: TASK_ID,
			containerRef: "container-abc",
			branch: "ak-branch",
			worktreePath: "/tmp/worktree",
			setupComplete: true,
		});
		await workspaceRepo.upsert(ws);

		const retrieved = await workspaceRepo.get(Workspace.ById(ws.id));
		expect(retrieved).not.toBeNull();
		expectEntityEqual(retrieved as Workspace, ws, ["createdAt", "updatedAt"]);
	});

	test("preserves null worktreePath", async () => {
		const ws = createTestWorkspace({ taskId: TASK_ID, worktreePath: null });
		await workspaceRepo.upsert(ws);

		const retrieved = await workspaceRepo.get(Workspace.ById(ws.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.worktreePath).toBeNull();
	});

	test("preserves setupComplete false", async () => {
		const ws = createTestWorkspace({ taskId: TASK_ID, setupComplete: false });
		await workspaceRepo.upsert(ws);

		const retrieved = await workspaceRepo.get(Workspace.ById(ws.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.setupComplete).toBe(false);
	});

	test("preserves setupComplete true", async () => {
		const ws = createTestWorkspace({ taskId: TASK_ID, setupComplete: true });
		await workspaceRepo.upsert(ws);

		const retrieved = await workspaceRepo.get(Workspace.ById(ws.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.setupComplete).toBe(true);
	});

	test("preserves attempt", async () => {
		const ws = createTestWorkspace({ taskId: TASK_ID, attempt: 3 });
		await workspaceRepo.upsert(ws);

		const retrieved = await workspaceRepo.get(Workspace.ById(ws.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.attempt).toBe(3);
	});

	test("preserves archived false", async () => {
		const ws = createTestWorkspace({ taskId: TASK_ID, archived: false });
		await workspaceRepo.upsert(ws);

		const retrieved = await workspaceRepo.get(Workspace.ById(ws.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.archived).toBe(false);
	});

	test("preserves archived true", async () => {
		const ws = createTestWorkspace({ taskId: TASK_ID, archived: true });
		await workspaceRepo.upsert(ws);

		const retrieved = await workspaceRepo.get(Workspace.ById(ws.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.archived).toBe(true);
	});
});

// ============================================
// P2: Update round-trip
// ============================================

describe("WorkspaceRepository update round-trip", () => {
	test("reflects all changed fields", async () => {
		const ws = createTestWorkspace({ taskId: TASK_ID });
		await workspaceRepo.upsert(ws);

		const updated: Workspace = {
			...ws,
			containerRef: "new-container",
			branch: "new-branch",
			worktreePath: "/tmp/new-worktree",
			setupComplete: true,
			updatedAt: new Date(),
		};
		await workspaceRepo.upsert(updated);

		const retrieved = await workspaceRepo.get(Workspace.ById(ws.id));
		expect(retrieved).not.toBeNull();
		expectEntityEqual(retrieved as Workspace, updated, [
			"createdAt",
			"updatedAt",
		]);
	});
});

// ============================================
// P3: Empty collection
// ============================================

describe("WorkspaceRepository empty collection", () => {
	test("get returns null for non-existent id", async () => {
		expect(await workspaceRepo.get(Workspace.ById("non-existent"))).toBeNull();
	});

	test("list returns empty page", async () => {
		const page = await workspaceRepo.list(Workspace.ByTaskId("non-existent"), {
			limit: 10,
		});
		expect(page.items).toHaveLength(0);
		expect(page.hasMore).toBe(false);
	});
});

// ============================================
// P4: Multiple elements
// ============================================

describe("WorkspaceRepository multiple elements", () => {
	test("stores and retrieves multiple workspaces", async () => {
		for (let i = 0; i < 3; i++) {
			await workspaceRepo.upsert(createTestWorkspace({ taskId: TASK_ID }));
		}

		const page = await workspaceRepo.list(Workspace.ByTaskId(TASK_ID), {
			limit: 50,
		});
		expect(page.items).toHaveLength(3);
	});
});

// ============================================
// P5: Delete
// ============================================

describe("WorkspaceRepository delete", () => {
	test("deletes and confirms absence", async () => {
		const ws = createTestWorkspace({ taskId: TASK_ID });
		await workspaceRepo.upsert(ws);

		const deleted = await workspaceRepo.delete(Workspace.ById(ws.id));
		expect(deleted).toBe(1);
		expect(await workspaceRepo.get(Workspace.ById(ws.id))).toBeNull();
	});

	test("returns 0 when nothing to delete", async () => {
		expect(await workspaceRepo.delete(Workspace.ById("non-existent"))).toBe(0);
	});
});

// ============================================
// P6: Spec filtering
// ============================================

describe("WorkspaceRepository spec filtering", () => {
	test("ById finds correct workspace", async () => {
		const ws = createTestWorkspace({ taskId: TASK_ID });
		await workspaceRepo.upsert(ws);

		const retrieved = await workspaceRepo.get(Workspace.ById(ws.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.id).toBe(ws.id);
	});

	test("ByTaskId filters by task", async () => {
		const ws = createTestWorkspace({ taskId: TASK_ID });
		await workspaceRepo.upsert(ws);

		const page = await workspaceRepo.list(Workspace.ByTaskId(TASK_ID), {
			limit: 50,
		});
		expect(page.items).toHaveLength(1);
		expect(page.items[0].taskId).toBe(TASK_ID);
	});
});

// ============================================
// P7: ByTaskIdActive spec
// ============================================

describe("WorkspaceRepository ByTaskIdActive", () => {
	test("finds non-archived workspace", async () => {
		const ws = createTestWorkspace({ taskId: TASK_ID, archived: false });
		await workspaceRepo.upsert(ws);

		const retrieved = await workspaceRepo.get(
			Workspace.ByTaskIdActive(TASK_ID),
		);
		expect(retrieved).not.toBeNull();
		expect(retrieved?.id).toBe(ws.id);
	});

	test("excludes archived workspace", async () => {
		const ws = createTestWorkspace({ taskId: TASK_ID, archived: true });
		await workspaceRepo.upsert(ws);

		const retrieved = await workspaceRepo.get(
			Workspace.ByTaskIdActive(TASK_ID),
		);
		expect(retrieved).toBeNull();
	});

	test("returns active workspace when both active and archived exist", async () => {
		const archived = createTestWorkspace({
			taskId: TASK_ID,
			archived: true,
			attempt: 1,
		});
		const active = createTestWorkspace({
			taskId: TASK_ID,
			archived: false,
			attempt: 2,
		});
		await workspaceRepo.upsert(archived);
		await workspaceRepo.upsert(active);

		const retrieved = await workspaceRepo.get(
			Workspace.ByTaskIdActive(TASK_ID),
		);
		expect(retrieved).not.toBeNull();
		expect(retrieved?.id).toBe(active.id);
	});
});

// ============================================
// P8: getMaxAttempt
// ============================================

describe("WorkspaceRepository getMaxAttempt", () => {
	test("returns 0 when no workspaces exist", async () => {
		expect(await workspaceRepo.getMaxAttempt("non-existent")).toBe(0);
	});

	test("returns max attempt for task", async () => {
		await workspaceRepo.upsert(
			createTestWorkspace({ taskId: TASK_ID, attempt: 1 }),
		);
		await workspaceRepo.upsert(
			createTestWorkspace({ taskId: TASK_ID, attempt: 3 }),
		);
		await workspaceRepo.upsert(
			createTestWorkspace({ taskId: TASK_ID, attempt: 2 }),
		);

		expect(await workspaceRepo.getMaxAttempt(TASK_ID)).toBe(3);
	});
});

// ============================================
// P9: findByWorktreePath
// ============================================

describe("WorkspaceRepository findByWorktreePath", () => {
	test("finds workspace by worktree path", async () => {
		const ws = createTestWorkspace({
			taskId: TASK_ID,
			worktreePath: "/tmp/my-worktree",
		});
		await workspaceRepo.upsert(ws);

		const found = await workspaceRepo.findByWorktreePath("/tmp/my-worktree");
		expect(found).not.toBeNull();
		expect(found?.id).toBe(ws.id);
	});

	test("returns null for non-existent worktree path", async () => {
		expect(
			await workspaceRepo.findByWorktreePath("/tmp/no-such-worktree"),
		).toBeNull();
	});
});
