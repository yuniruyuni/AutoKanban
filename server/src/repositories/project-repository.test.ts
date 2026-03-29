import type { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createTestProject, createTestTask } from "../../test/factories";
import { createTestDB } from "../../test/helpers/db";
import { expectEntityEqual } from "../../test/helpers/entity-equality";
import { Project } from "../models/project";
import { ProjectRepository } from "./project-repository";
import { TaskRepository } from "./task";

let db: Database;
let projectRepo: ProjectRepository;
let taskRepo: TaskRepository;

beforeEach(() => {
	db = createTestDB();
	projectRepo = new ProjectRepository(db);
	taskRepo = new TaskRepository(db);
});

afterEach(() => {
	db.close();
});

// ============================================
// upsert + get
// ============================================

describe("ProjectRepository upsert + get", () => {
	test("inserts and retrieves a project", () => {
		const project = createTestProject();
		projectRepo.upsert(project);

		const retrieved = projectRepo.get(Project.ById(project.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.name).toBe(project.name);
		expect(retrieved?.repoPath).toBe(project.repoPath);
	});

	test("updates existing project on conflict", () => {
		const project = createTestProject();
		projectRepo.upsert(project);

		const updated = { ...project, name: "Updated Name", updatedAt: new Date() };
		projectRepo.upsert(updated);

		const retrieved = projectRepo.get(Project.ById(project.id));
		expect(retrieved?.name).toBe("Updated Name");
	});

	test("returns null for non-existent id", () => {
		expect(projectRepo.get(Project.ById("non-existent"))).toBeNull();
	});

	test("ByName finds project", () => {
		const project = createTestProject({ name: "unique-name" });
		projectRepo.upsert(project);

		const retrieved = projectRepo.get(Project.ByName("unique-name"));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.id).toBe(project.id);
	});

	test("ByRepoPath finds project", () => {
		const project = createTestProject({ repoPath: "/unique/path" });
		projectRepo.upsert(project);

		const retrieved = projectRepo.get(Project.ByRepoPath("/unique/path"));
		expect(retrieved).not.toBeNull();
	});

	test("P1: round-trip preserves all fields", () => {
		const project = createTestProject({
			name: "Round Trip Project",
			description: "Full description",
			repoPath: "/tmp/roundtrip-repo",
			branch: "develop",
			setupScript: "npm install",
			cleanupScript: "npm run clean",
			devServerScript: "npm run dev",
		});
		projectRepo.upsert(project);

		const retrieved = projectRepo.get(Project.ById(project.id));
		expect(retrieved).not.toBeNull();
		expectEntityEqual(retrieved as Project, project, [
			"createdAt",
			"updatedAt",
		]);
	});

	test("P2: update round-trip reflects all changed fields", () => {
		const project = createTestProject();
		projectRepo.upsert(project);

		const updated: Project = {
			...project,
			name: "Updated Name",
			description: "Updated description",
			repoPath: "/tmp/updated-repo",
			branch: "feature-branch",
			setupScript: "bun install",
			cleanupScript: "bun run clean",
			devServerScript: "bun run dev",
			updatedAt: new Date(),
		};
		projectRepo.upsert(updated);

		const retrieved = projectRepo.get(Project.ById(project.id));
		expect(retrieved).not.toBeNull();
		expectEntityEqual(retrieved as Project, updated, [
			"createdAt",
			"updatedAt",
		]);
	});

	test("P1: round-trip with null optional fields", () => {
		const project = createTestProject({
			description: null,
			setupScript: null,
			cleanupScript: null,
			devServerScript: null,
		});
		projectRepo.upsert(project);

		const retrieved = projectRepo.get(Project.ById(project.id));
		expect(retrieved).not.toBeNull();
		expectEntityEqual(retrieved as Project, project, [
			"createdAt",
			"updatedAt",
		]);
	});
});

// ============================================
// list / listAll
// ============================================

describe("ProjectRepository list", () => {
	test("lists projects with pagination", () => {
		for (let i = 0; i < 5; i++) {
			projectRepo.upsert(createTestProject({ repoPath: `/tmp/repo-${i}` }));
		}

		const page = projectRepo.list(Project.All(), { limit: 3 });
		expect(page.items).toHaveLength(3);
		expect(page.hasMore).toBe(true);
	});

	test("listAll returns all projects", () => {
		for (let i = 0; i < 3; i++) {
			projectRepo.upsert(createTestProject({ repoPath: `/tmp/repo-${i}` }));
		}

		const all = projectRepo.listAll();
		expect(all).toHaveLength(3);
	});
});

// ============================================
// listAllWithStats / getWithStats
// ============================================

describe("ProjectRepository stats", () => {
	test("listAllWithStats includes task statistics", () => {
		const project = createTestProject();
		projectRepo.upsert(project);

		taskRepo.upsert(createTestTask({ projectId: project.id, status: "todo" }));
		taskRepo.upsert(createTestTask({ projectId: project.id, status: "todo" }));
		taskRepo.upsert(
			createTestTask({ projectId: project.id, status: "inprogress" }),
		);
		taskRepo.upsert(createTestTask({ projectId: project.id, status: "done" }));

		const results = projectRepo.listAllWithStats();
		expect(results).toHaveLength(1);
		expect(results[0].taskStats.todo).toBe(2);
		expect(results[0].taskStats.inProgress).toBe(1);
		expect(results[0].taskStats.inReview).toBe(0);
		expect(results[0].taskStats.done).toBe(1);
		expect(results[0].taskStats.cancelled).toBe(0);
	});

	test("getWithStats returns stats for specific project", () => {
		const project = createTestProject();
		projectRepo.upsert(project);

		taskRepo.upsert(
			createTestTask({ projectId: project.id, status: "inreview" }),
		);

		const result = projectRepo.getWithStats(project.id);
		expect(result).not.toBeNull();
		expect(result?.taskStats.inReview).toBe(1);
	});

	test("getWithStats returns null for non-existent project", () => {
		expect(projectRepo.getWithStats("non-existent")).toBeNull();
	});

	test("stats are zero for project with no tasks", () => {
		const project = createTestProject();
		projectRepo.upsert(project);

		const results = projectRepo.listAllWithStats();
		expect(results[0].taskStats.todo).toBe(0);
		expect(results[0].taskStats.inProgress).toBe(0);
		expect(results[0].taskStats.done).toBe(0);
	});
});

// ============================================
// delete
// ============================================

describe("ProjectRepository delete", () => {
	test("deletes a project", () => {
		const project = createTestProject();
		projectRepo.upsert(project);

		const deleted = projectRepo.delete(Project.ById(project.id));
		expect(deleted).toBe(1);
		expect(projectRepo.get(Project.ById(project.id))).toBeNull();
	});

	test("returns 0 when nothing to delete", () => {
		expect(projectRepo.delete(Project.ById("non-existent"))).toBe(0);
	});
});
