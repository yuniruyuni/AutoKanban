import { describe, expect, test } from "bun:test";
import { isCompLogical } from "../common";
import { Project } from ".";

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
// Project.validateName()
// ============================================

describe("Project.validateName()", () => {
	test("returns null for valid name", () => {
		expect(Project.validateName("My Project")).toBeNull();
	});

	test("rejects empty string", () => {
		const error = Project.validateName("");
		expect(error).not.toBeNull();
		expect(error?.field).toBe("name");
	});

	test("rejects name longer than 100 characters", () => {
		const error = Project.validateName("a".repeat(101));
		expect(error).not.toBeNull();
		expect(error?.message).toContain("1-100");
	});

	test("accepts name with exactly 100 characters", () => {
		expect(Project.validateName("a".repeat(100))).toBeNull();
	});

	test("rejects name with forward slash", () => {
		const error = Project.validateName("foo/bar");
		expect(error).not.toBeNull();
		expect(error?.message).toContain("path separators");
	});

	test("rejects name with backslash", () => {
		const error = Project.validateName("foo\\bar");
		expect(error).not.toBeNull();
		expect(error?.message).toContain("path separators");
	});

	test("rejects name with null byte", () => {
		const error = Project.validateName("foo\0bar");
		expect(error).not.toBeNull();
	});

	test("rejects name starting with dot", () => {
		const error = Project.validateName(".hidden");
		expect(error).not.toBeNull();
		expect(error?.message).toContain("'.'");
	});

	test("rejects name with leading whitespace", () => {
		const error = Project.validateName(" name");
		expect(error).not.toBeNull();
		expect(error?.message).toContain("whitespace");
	});

	test("rejects name with trailing whitespace", () => {
		const error = Project.validateName("name ");
		expect(error).not.toBeNull();
		expect(error?.message).toContain("whitespace");
	});

	test("accepts name with internal spaces", () => {
		expect(Project.validateName("my project name")).toBeNull();
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
