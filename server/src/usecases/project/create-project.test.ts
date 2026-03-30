import { describe, expect, test } from "bun:test";
import { createTestProject } from "../../../test/factories";
import { createMockContext } from "../../../test/helpers/context";
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

		const result = await createProject({
			name: "My Project",
			repoPath: "/tmp/repo",
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.name).toBe("My Project");
			expect(result.value.repoPath).toBe("/tmp/repo");
			expect(result.value.branch).toBe("main");
		}
	});

	test("fails when name is empty", async () => {
		const ctx = createMockContext();
		const result = await createProject({ name: "", repoPath: "/tmp/repo" }).run(
			ctx,
		);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("INVALID_INPUT");
		}
	});

	test("fails when name is whitespace only", async () => {
		const ctx = createMockContext();
		const result = await createProject({
			name: "   ",
			repoPath: "/tmp/repo",
		}).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("INVALID_INPUT");
		}
	});

	test("fails when repoPath is empty", async () => {
		const ctx = createMockContext();
		const result = await createProject({ name: "Test", repoPath: "" }).run(ctx);

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

		const result = await createProject({
			name: "Test",
			repoPath: "/tmp/not-a-repo",
		}).run(ctx);

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

		const result = await createProject({
			name: "Test",
			repoPath: "/tmp/empty-repo",
		}).run(ctx);

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

		const result = await createProject({
			name: "New",
			repoPath: "/tmp/existing",
		}).run(ctx);

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

		const result = await createProject({
			name: "  Trimmed  ",
			description: "  desc  ",
			repoPath: "/tmp/repo",
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.name).toBe("Trimmed");
			expect(result.value.description).toBe("desc");
		}
	});
});
