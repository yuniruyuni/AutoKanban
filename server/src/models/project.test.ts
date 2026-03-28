import { describe, expect, test } from "bun:test";
import { isCompLogical } from "./common";
import { Project } from "./project";

// ============================================
// Project.create()
// ============================================

describe("Project.create()", () => {
	test("creates a project with required fields", () => {
		const project = Project.create({
			name: "My Project",
			repoPath: "/tmp/repo",
		});
		expect(project.name).toBe("My Project");
		expect(project.repoPath).toBe("/tmp/repo");
	});

	test("generates a UUID id", () => {
		const project = Project.create({
			name: "My Project",
			repoPath: "/tmp/repo",
		});
		expect(project.id).toMatch(/^[0-9a-f]{8}-/);
	});

	test('branch defaults to "main"', () => {
		const project = Project.create({
			name: "My Project",
			repoPath: "/tmp/repo",
		});
		expect(project.branch).toBe("main");
	});

	test("branch can be overridden", () => {
		const project = Project.create({
			name: "My Project",
			repoPath: "/tmp/repo",
			branch: "develop",
		});
		expect(project.branch).toBe("develop");
	});

	test("description defaults to null", () => {
		const project = Project.create({
			name: "My Project",
			repoPath: "/tmp/repo",
		});
		expect(project.description).toBeNull();
	});

	test("script fields default to null", () => {
		const project = Project.create({
			name: "My Project",
			repoPath: "/tmp/repo",
		});
		expect(project.setupScript).toBeNull();
		expect(project.cleanupScript).toBeNull();
		expect(project.devServerScript).toBeNull();
	});

	test("script fields can be set", () => {
		const project = Project.create({
			name: "My Project",
			repoPath: "/tmp/repo",
			setupScript: "bun install",
			cleanupScript: "rm -rf dist",
			devServerScript: "bun run dev",
		});
		expect(project.setupScript).toBe("bun install");
		expect(project.cleanupScript).toBe("rm -rf dist");
		expect(project.devServerScript).toBe("bun run dev");
	});

	test("sets createdAt and updatedAt to the same time", () => {
		const project = Project.create({
			name: "My Project",
			repoPath: "/tmp/repo",
		});
		expect(project.createdAt).toEqual(project.updatedAt);
		expect(project.createdAt).toBeInstanceOf(Date);
	});
});

// ============================================
// Project.cursor()
// ============================================

describe("Project.cursor()", () => {
	const now = new Date("2025-01-15T10:00:00.000Z");
	const project: Project = {
		id: "proj-1",
		name: "Test",
		description: null,
		repoPath: "/tmp/repo",
		branch: "main",
		setupScript: null,
		cleanupScript: null,
		devServerScript: null,
		createdAt: now,
		updatedAt: now,
	};

	test("Date values are converted to ISO strings", () => {
		const cursor = Project.cursor(project, ["createdAt"]);
		expect(cursor.createdAt).toBe("2025-01-15T10:00:00.000Z");
	});

	test("String values are kept as strings", () => {
		const cursor = Project.cursor(project, ["id"]);
		expect(cursor.id).toBe("proj-1");
	});
});

// ============================================
// Project Specs
// ============================================

describe("Project specs", () => {
	test("ById creates a spec", () => {
		const spec = Project.ById("abc");
		expect((spec as { type: string }).type).toBe("ById");
	});

	test("ByName creates a spec", () => {
		const spec = Project.ByName("test");
		expect((spec as { type: string }).type).toBe("ByName");
		expect((spec as { name: string }).name).toBe("test");
	});

	test("ByRepoPath creates a spec", () => {
		const spec = Project.ByRepoPath("/tmp/repo");
		expect((spec as { type: string }).type).toBe("ByRepoPath");
	});

	test("All creates a spec", () => {
		const spec = Project.All();
		expect((spec as { type: string }).type).toBe("All");
	});

	test("specs are composable", () => {
		const composed = Project.ById("1").and(Project.ByName("test"));
		expect(isCompLogical(composed)).toBe(true);
	});
});
