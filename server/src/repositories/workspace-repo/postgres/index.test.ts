import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	createTestProject,
	createTestWorkspaceRepo,
} from "../../../../test/factories";
import { closeTestDB, createTestDB } from "../../../../test/helpers/db";
import { expectEntityEqual } from "../../../../test/helpers/entity-equality";
import { seedFullChain } from "../../../../test/helpers/seed";
import type { Database } from "../../common";
import { WorkspaceRepo } from "../../../models/workspace-repo";
import type { DbReadCtx, DbWriteCtx } from "../../common";
import { createDbReadCtx, createDbWriteCtx } from "../../common";
import { ProjectRepository } from "../../project/postgres";
import { WorkspaceRepoRepository } from ".";

let db: Database;
let wsRepoRepo: WorkspaceRepoRepository;
let rCtx: DbReadCtx;
let wCtx: DbWriteCtx;
let WORKSPACE_ID: string;
let PROJECT_ID: string;

beforeEach(async () => {
	db = await createTestDB();
	wsRepoRepo = new WorkspaceRepoRepository();
	rCtx = createDbReadCtx(db);
	wCtx = createDbWriteCtx(db);

	const seed = await seedFullChain(db);
	WORKSPACE_ID = seed.workspace.id;
	PROJECT_ID = seed.project.id;
});

afterEach(async () => {
	await closeTestDB(db);
});

// ============================================
// P1: Round-trip
// ============================================

describe("WorkspaceRepoRepository round-trip", () => {
	test("preserves all fields", async () => {
		const wr = createTestWorkspaceRepo({
			workspaceId: WORKSPACE_ID,
			projectId: PROJECT_ID,
			targetBranch: "feature-branch",
		});
		await wsRepoRepo.upsert(wCtx, wr);

		const retrieved = await wsRepoRepo.get(rCtx, WorkspaceRepo.ById(wr.id));
		expect(retrieved).not.toBeNull();
		expectEntityEqual(retrieved as WorkspaceRepo, wr, [
			"createdAt",
			"updatedAt",
		]);
	});
});

// ============================================
// P2: Update round-trip
// ============================================

describe("WorkspaceRepoRepository update round-trip", () => {
	test("reflects targetBranch and updatedAt changes", async () => {
		const wr = createTestWorkspaceRepo({
			workspaceId: WORKSPACE_ID,
			projectId: PROJECT_ID,
			targetBranch: "original",
		});
		await wsRepoRepo.upsert(wCtx, wr);

		const updated: WorkspaceRepo = {
			...wr,
			targetBranch: "updated-branch",
			updatedAt: new Date(),
		};
		await wsRepoRepo.upsert(wCtx, updated);

		const retrieved = await wsRepoRepo.get(rCtx, WorkspaceRepo.ById(wr.id));
		expect(retrieved).not.toBeNull();
		expectEntityEqual(retrieved as WorkspaceRepo, updated, [
			"createdAt",
			"updatedAt",
		]);
	});
});

// ============================================
// P3: Empty collection
// ============================================

describe("WorkspaceRepoRepository empty collection", () => {
	test("get returns null for non-existent id", async () => {
		expect(
			await wsRepoRepo.get(rCtx, WorkspaceRepo.ById("non-existent")),
		).toBeNull();
	});

	test("list returns empty page", async () => {
		const page = await wsRepoRepo.list(
			rCtx,
			WorkspaceRepo.ByWorkspaceId("non-existent"),
			{
				limit: 10,
			},
		);
		expect(page.items).toHaveLength(0);
		expect(page.hasMore).toBe(false);
	});

	test("listByWorkspace returns empty array", async () => {
		expect(await wsRepoRepo.listByWorkspace(rCtx, "non-existent")).toHaveLength(
			0,
		);
	});
});

// ============================================
// P4: Multiple elements
// ============================================

describe("WorkspaceRepoRepository multiple elements", () => {
	test("stores and retrieves multiple workspace repos", async () => {
		// Need multiple projects for unique (workspace_id, project_id) constraint
		const projectRepo = new ProjectRepository();
		const project2 = createTestProject({
			name: "Project 2",
			repoPath: "/tmp/repo-2",
		});
		const project3 = createTestProject({
			name: "Project 3",
			repoPath: "/tmp/repo-3",
		});
		await projectRepo.upsert(wCtx, project2);
		await projectRepo.upsert(wCtx, project3);

		await wsRepoRepo.upsert(
			wCtx,
			createTestWorkspaceRepo({
				workspaceId: WORKSPACE_ID,
				projectId: PROJECT_ID,
				targetBranch: "main",
			}),
		);
		await wsRepoRepo.upsert(
			wCtx,
			createTestWorkspaceRepo({
				workspaceId: WORKSPACE_ID,
				projectId: project2.id,
				targetBranch: "develop",
			}),
		);
		await wsRepoRepo.upsert(
			wCtx,
			createTestWorkspaceRepo({
				workspaceId: WORKSPACE_ID,
				projectId: project3.id,
				targetBranch: "feature",
			}),
		);

		const page = await wsRepoRepo.list(
			rCtx,
			WorkspaceRepo.ByWorkspaceId(WORKSPACE_ID),
			{
				limit: 50,
			},
		);
		expect(page.items).toHaveLength(3);
	});
});

// ============================================
// P5: Delete
// ============================================

describe("WorkspaceRepoRepository delete", () => {
	test("deletes and confirms absence", async () => {
		const wr = createTestWorkspaceRepo({
			workspaceId: WORKSPACE_ID,
			projectId: PROJECT_ID,
		});
		await wsRepoRepo.upsert(wCtx, wr);

		const deleted = await wsRepoRepo.delete(wCtx, WorkspaceRepo.ById(wr.id));
		expect(deleted).toBe(1);
		expect(await wsRepoRepo.get(rCtx, WorkspaceRepo.ById(wr.id))).toBeNull();
	});

	test("returns 0 when nothing to delete", async () => {
		expect(
			await wsRepoRepo.delete(wCtx, WorkspaceRepo.ById("non-existent")),
		).toBe(0);
	});
});

// ============================================
// P6: Spec filtering
// ============================================

describe("WorkspaceRepoRepository spec filtering", () => {
	test("ById finds correct record", async () => {
		const wr = createTestWorkspaceRepo({
			workspaceId: WORKSPACE_ID,
			projectId: PROJECT_ID,
		});
		await wsRepoRepo.upsert(wCtx, wr);

		const retrieved = await wsRepoRepo.get(rCtx, WorkspaceRepo.ById(wr.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.id).toBe(wr.id);
	});

	test("ByWorkspaceId filters by workspace", async () => {
		const wr = createTestWorkspaceRepo({
			workspaceId: WORKSPACE_ID,
			projectId: PROJECT_ID,
		});
		await wsRepoRepo.upsert(wCtx, wr);

		const page = await wsRepoRepo.list(
			rCtx,
			WorkspaceRepo.ByWorkspaceId(WORKSPACE_ID),
			{
				limit: 50,
			},
		);
		expect(page.items).toHaveLength(1);
		expect(page.items[0].workspaceId).toBe(WORKSPACE_ID);
	});

	test("ByProjectId filters by project", async () => {
		const wr = createTestWorkspaceRepo({
			workspaceId: WORKSPACE_ID,
			projectId: PROJECT_ID,
		});
		await wsRepoRepo.upsert(wCtx, wr);

		const page = await wsRepoRepo.list(
			rCtx,
			WorkspaceRepo.ByProjectId(PROJECT_ID),
			{
				limit: 50,
			},
		);
		expect(page.items).toHaveLength(1);
		expect(page.items[0].projectId).toBe(PROJECT_ID);
	});

	test("ByWorkspaceAndProject filters by both", async () => {
		const wr = createTestWorkspaceRepo({
			workspaceId: WORKSPACE_ID,
			projectId: PROJECT_ID,
		});
		await wsRepoRepo.upsert(wCtx, wr);

		const retrieved = await wsRepoRepo.get(
			rCtx,
			WorkspaceRepo.ByWorkspaceAndProject(WORKSPACE_ID, PROJECT_ID),
		);
		expect(retrieved).not.toBeNull();
		expect(retrieved?.workspaceId).toBe(WORKSPACE_ID);
		expect(retrieved?.projectId).toBe(PROJECT_ID);
	});
});

// ============================================
// P7: listByWorkspace
// ============================================

describe("WorkspaceRepoRepository listByWorkspace", () => {
	test("returns all records for a workspace", async () => {
		const projectRepo = new ProjectRepository();
		const project2 = createTestProject({
			name: "P2",
			repoPath: "/tmp/repo-p2",
		});
		await projectRepo.upsert(wCtx, project2);

		await wsRepoRepo.upsert(
			wCtx,
			createTestWorkspaceRepo({
				workspaceId: WORKSPACE_ID,
				projectId: PROJECT_ID,
				targetBranch: "main",
			}),
		);
		await wsRepoRepo.upsert(
			wCtx,
			createTestWorkspaceRepo({
				workspaceId: WORKSPACE_ID,
				projectId: project2.id,
				targetBranch: "develop",
			}),
		);

		const results = await wsRepoRepo.listByWorkspace(rCtx, WORKSPACE_ID);
		expect(results).toHaveLength(2);
	});
});
