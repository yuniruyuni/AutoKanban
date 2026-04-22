import { describe, expect, test } from "bun:test";
import { createTestProject } from "../../../test/factories";
import { createMockContext } from "../../../test/helpers/context";
import { Project } from "../../models/project";
import { createProject } from "./create-project";

const validGitMock = {
	isGitRepo: async () => true,
	listBranches: async () => [{ name: "main", isCurrent: true }],
} as never;

const templateAndTaskMock = {
	taskTemplate: { listAll: () => [] } as never,
	task: { upsert: () => {} } as never,
};

describe("createProject", () => {
	test("creates a project with valid input", async () => {
		const ctx = createMockContext({
			project: {
				get: () => null,
				upsert: () => {},
			} as never,
			git: validGitMock,
			...templateAndTaskMock,
		});

		const project = Project.create({
			name: "My Project",
			repoPath: "/tmp/repo",
		});
		const result = await createProject(project).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.name).toBe("My Project");
			expect(result.value.repoPath).toBe("/tmp/repo");
			expect(result.value.branch).toBe("main");
		}
	});

	test("fails when name is empty", async () => {
		const ctx = createMockContext();
		const project = Project.create({ name: "", repoPath: "/tmp/repo" });
		const result = await createProject(project).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("INVALID_INPUT");
		}
	});

	test("fails when name is whitespace only", async () => {
		const ctx = createMockContext();
		const project = Project.create({ name: "   ", repoPath: "/tmp/repo" });
		const result = await createProject(project).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("INVALID_INPUT");
		}
	});

	test("fails when repoPath is empty", async () => {
		const ctx = createMockContext();
		const project = Project.create({ name: "Test", repoPath: "" });
		const result = await createProject(project).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("INVALID_INPUT");
		}
	});

	test("fails when repoPath is not a git repository", async () => {
		const ctx = createMockContext({
			project: {
				get: () => null,
				upsert: () => {},
			} as never,
			...templateAndTaskMock,
			git: {
				isGitRepo: async () => false,
			} as never,
		});

		const project = Project.create({
			name: "Test",
			repoPath: "/tmp/not-a-repo",
		});
		const result = await createProject(project).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("INVALID_INPUT");
			expect(result.error.message).toContain("not a git repository");
		}
	});

	test("fails when repository has no commits", async () => {
		const ctx = createMockContext({
			project: {
				get: () => null,
				upsert: () => {},
			} as never,
			...templateAndTaskMock,
			git: {
				isGitRepo: async () => true,
				listBranches: async () => [],
			} as never,
		});

		const project = Project.create({
			name: "Test",
			repoPath: "/tmp/empty-repo",
		});
		const result = await createProject(project).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("INVALID_INPUT");
			expect(result.error.message).toContain("no commits");
		}
	});

	test("fails when duplicate repoPath exists", async () => {
		const existing = createTestProject({ repoPath: "/tmp/existing" });
		const ctx = createMockContext({
			project: {
				get: () => existing,
				upsert: () => {},
			} as never,
			git: validGitMock,
		});

		const project = Project.create({ name: "New", repoPath: "/tmp/existing" });
		const result = await createProject(project).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("DUPLICATE");
		}
	});

	test("trims name and description", async () => {
		const ctx = createMockContext({
			project: {
				get: () => null,
				upsert: () => {},
			} as never,
			git: validGitMock,
			...templateAndTaskMock,
		});

		const project = Project.create({
			name: "  Trimmed  ".trim(),
			description: "  desc  ".trim(),
			repoPath: "/tmp/repo",
		});
		const result = await createProject(project).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.name).toBe("Trimmed");
			expect(result.value.description).toBe("desc");
		}
	});
});
