import type { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	createTestProject,
	createTestWorkspaceRepo,
} from "../../test/factories";
import { createTestDB } from "../../test/helpers/db";
import { expectEntityEqual } from "../../test/helpers/entity-equality";
import { seedFullChain } from "../../test/helpers/seed";
import { WorkspaceRepo } from "../models/workspace-repo";
import { ProjectRepository } from "./project";
import { WorkspaceRepoRepository } from "./workspace-repo";

let db: Database;
let wsRepoRepo: WorkspaceRepoRepository;
let WORKSPACE_ID: string;
let PROJECT_ID: string;

beforeEach(() => {
	db = createTestDB();
	wsRepoRepo = new WorkspaceRepoRepository(db);

	const seed = seedFullChain(db);
	WORKSPACE_ID = seed.workspace.id;
	PROJECT_ID = seed.project.id;
});

afterEach(() => {
	db.close();
});

// ============================================
// P1: Round-trip
// ============================================

describe("WorkspaceRepoRepository round-trip", () => {
	test("preserves all fields", () => {
		const wr = createTestWorkspaceRepo({
			workspaceId: WORKSPACE_ID,
			projectId: PROJECT_ID,
			targetBranch: "feature-branch",
		});
		wsRepoRepo.upsert(wr);

		const retrieved = wsRepoRepo.get(WorkspaceRepo.ById(wr.id));
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
	test("reflects targetBranch and updatedAt changes", () => {
		const wr = createTestWorkspaceRepo({
			workspaceId: WORKSPACE_ID,
			projectId: PROJECT_ID,
			targetBranch: "original",
		});
		wsRepoRepo.upsert(wr);

		const updated: WorkspaceRepo = {
			...wr,
			targetBranch: "updated-branch",
			updatedAt: new Date(),
		};
		wsRepoRepo.upsert(updated);

		const retrieved = wsRepoRepo.get(WorkspaceRepo.ById(wr.id));
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
	test("get returns null for non-existent id", () => {
		expect(wsRepoRepo.get(WorkspaceRepo.ById("non-existent"))).toBeNull();
	});

	test("list returns empty page", () => {
		const page = wsRepoRepo.list(WorkspaceRepo.ByWorkspaceId("non-existent"), {
			limit: 10,
		});
		expect(page.items).toHaveLength(0);
		expect(page.hasMore).toBe(false);
	});

	test("listByWorkspace returns empty array", () => {
		expect(wsRepoRepo.listByWorkspace("non-existent")).toHaveLength(0);
	});
});

// ============================================
// P4: Multiple elements
// ============================================

describe("WorkspaceRepoRepository multiple elements", () => {
	test("stores and retrieves multiple workspace repos", () => {
		// Need multiple projects for unique (workspace_id, project_id) constraint
		const projectRepo = new ProjectRepository(db);
		const project2 = createTestProject({
			name: "Project 2",
			repoPath: "/tmp/repo-2",
		});
		const project3 = createTestProject({
			name: "Project 3",
			repoPath: "/tmp/repo-3",
		});
		projectRepo.upsert(project2);
		projectRepo.upsert(project3);

		wsRepoRepo.upsert(
			createTestWorkspaceRepo({
				workspaceId: WORKSPACE_ID,
				projectId: PROJECT_ID,
				targetBranch: "main",
			}),
		);
		wsRepoRepo.upsert(
			createTestWorkspaceRepo({
				workspaceId: WORKSPACE_ID,
				projectId: project2.id,
				targetBranch: "develop",
			}),
		);
		wsRepoRepo.upsert(
			createTestWorkspaceRepo({
				workspaceId: WORKSPACE_ID,
				projectId: project3.id,
				targetBranch: "feature",
			}),
		);

		const page = wsRepoRepo.list(WorkspaceRepo.ByWorkspaceId(WORKSPACE_ID), {
			limit: 50,
		});
		expect(page.items).toHaveLength(3);
	});
});

// ============================================
// P5: Delete
// ============================================

describe("WorkspaceRepoRepository delete", () => {
	test("deletes and confirms absence", () => {
		const wr = createTestWorkspaceRepo({
			workspaceId: WORKSPACE_ID,
			projectId: PROJECT_ID,
		});
		wsRepoRepo.upsert(wr);

		const deleted = wsRepoRepo.delete(WorkspaceRepo.ById(wr.id));
		expect(deleted).toBe(1);
		expect(wsRepoRepo.get(WorkspaceRepo.ById(wr.id))).toBeNull();
	});

	test("returns 0 when nothing to delete", () => {
		expect(wsRepoRepo.delete(WorkspaceRepo.ById("non-existent"))).toBe(0);
	});
});

// ============================================
// P6: Spec filtering
// ============================================

describe("WorkspaceRepoRepository spec filtering", () => {
	test("ById finds correct record", () => {
		const wr = createTestWorkspaceRepo({
			workspaceId: WORKSPACE_ID,
			projectId: PROJECT_ID,
		});
		wsRepoRepo.upsert(wr);

		const retrieved = wsRepoRepo.get(WorkspaceRepo.ById(wr.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.id).toBe(wr.id);
	});

	test("ByWorkspaceId filters by workspace", () => {
		const wr = createTestWorkspaceRepo({
			workspaceId: WORKSPACE_ID,
			projectId: PROJECT_ID,
		});
		wsRepoRepo.upsert(wr);

		const page = wsRepoRepo.list(WorkspaceRepo.ByWorkspaceId(WORKSPACE_ID), {
			limit: 50,
		});
		expect(page.items).toHaveLength(1);
		expect(page.items[0].workspaceId).toBe(WORKSPACE_ID);
	});

	test("ByProjectId filters by project", () => {
		const wr = createTestWorkspaceRepo({
			workspaceId: WORKSPACE_ID,
			projectId: PROJECT_ID,
		});
		wsRepoRepo.upsert(wr);

		const page = wsRepoRepo.list(WorkspaceRepo.ByProjectId(PROJECT_ID), {
			limit: 50,
		});
		expect(page.items).toHaveLength(1);
		expect(page.items[0].projectId).toBe(PROJECT_ID);
	});

	test("ByWorkspaceAndProject filters by both", () => {
		const wr = createTestWorkspaceRepo({
			workspaceId: WORKSPACE_ID,
			projectId: PROJECT_ID,
		});
		wsRepoRepo.upsert(wr);

		const retrieved = wsRepoRepo.get(
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
	test("returns all records for a workspace", () => {
		const projectRepo = new ProjectRepository(db);
		const project2 = createTestProject({
			name: "P2",
			repoPath: "/tmp/repo-p2",
		});
		projectRepo.upsert(project2);

		wsRepoRepo.upsert(
			createTestWorkspaceRepo({
				workspaceId: WORKSPACE_ID,
				projectId: PROJECT_ID,
				targetBranch: "main",
			}),
		);
		wsRepoRepo.upsert(
			createTestWorkspaceRepo({
				workspaceId: WORKSPACE_ID,
				projectId: project2.id,
				targetBranch: "develop",
			}),
		);

		const results = wsRepoRepo.listByWorkspace(WORKSPACE_ID);
		expect(results).toHaveLength(2);
	});
});
