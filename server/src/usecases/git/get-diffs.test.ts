import { describe, expect, test } from "bun:test";
import {
	createTestProject,
	createTestWorkspace,
} from "../../../test/factories";
import { createTestGitDiffs } from "../../../test/factories/git";
import { createMockContext } from "../../../test/helpers/context";
import {
	createMockGitRepository,
	createMockWorktreeRepository,
} from "../../../test/helpers/git";
import { getDiffs } from "./get-diffs";

describe("getDiffs", () => {
	test("returns diffs with totals for valid workspace and project", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject();
		const diffs = createTestGitDiffs(3);

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			workspaceRepo: { listByWorkspace: () => [] } as never,
			worktree: createMockWorktreeRepository(),
			git: createMockGitRepository({
				getDiffs: async () => diffs,
			}),
		});

		const result = await getDiffs(workspace.id, project.id).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.diffs).toHaveLength(3);
			expect(result.value.totalAdditions).toBeGreaterThan(0);
			expect(result.value.totalDeletions).toBeGreaterThanOrEqual(0);
		}
	});

	test("calculates totals correctly", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject();
		const diffs = [
			{
				filePath: "a.ts",
				status: "modified" as const,
				additions: 10,
				deletions: 5,
			},
			{
				filePath: "b.ts",
				status: "added" as const,
				additions: 20,
				deletions: 0,
			},
			{
				filePath: "c.ts",
				status: "deleted" as const,
				additions: 0,
				deletions: 15,
			},
		];

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			workspaceRepo: { listByWorkspace: () => [] } as never,
			worktree: createMockWorktreeRepository(),
			git: createMockGitRepository({
				getDiffs: async () => diffs,
			}),
		});

		const result = await getDiffs(workspace.id, project.id).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.totalAdditions).toBe(30);
			expect(result.value.totalDeletions).toBe(20);
		}
	});

	test("uses custom baseCommit when provided", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject();

		let capturedBaseCommit: string | undefined;

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			worktree: createMockWorktreeRepository(),
			git: createMockGitRepository({
				getDiffs: async (_path: string, baseCommit: string) => {
					capturedBaseCommit = baseCommit;
					return [];
				},
			}),
		});

		await getDiffs(workspace.id, project.id, "abc123").run(ctx);

		expect(capturedBaseCommit).toBe("abc123");
	});

	test("uses workspace repo targetBranch as default baseCommit", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject({ branch: "main" });
		const workspaceRepo = {
			projectId: project.id,
			targetBranch: "feature/custom",
		};

		let capturedBaseCommit: string | undefined;

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			workspaceRepo: { listByWorkspace: () => [workspaceRepo] } as never,
			worktree: createMockWorktreeRepository(),
			git: createMockGitRepository({
				getDiffs: async (_path: string, baseCommit: string) => {
					capturedBaseCommit = baseCommit;
					return [];
				},
			}),
		});

		await getDiffs(workspace.id, project.id).run(ctx);

		expect(capturedBaseCommit).toBe("feature/custom");
	});

	test("falls back to project.branch when no workspace repo", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject({ branch: "develop" });

		let capturedBaseCommit: string | undefined;

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			workspaceRepo: { listByWorkspace: () => [] } as never,
			worktree: createMockWorktreeRepository(),
			git: createMockGitRepository({
				getDiffs: async (_path: string, baseCommit: string) => {
					capturedBaseCommit = baseCommit;
					return [];
				},
			}),
		});

		await getDiffs(workspace.id, project.id).run(ctx);

		expect(capturedBaseCommit).toBe("develop");
	});

	test("returns NOT_FOUND when workspace does not exist", async () => {
		const ctx = createMockContext({
			workspace: { get: () => null } as never,
		});

		const result = await getDiffs("non-existent", "proj-1").run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
		}
	});

	test("returns NOT_FOUND when project does not exist", async () => {
		const workspace = createTestWorkspace();

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => null } as never,
		});

		const result = await getDiffs(workspace.id, "non-existent").run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
		}
	});

	test("returns NOT_FOUND when worktree does not exist", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject();

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			workspaceRepo: { listByWorkspace: () => [] } as never,
			worktree: createMockWorktreeRepository({
				worktreeExists: async () => false,
			}),
		});

		const result = await getDiffs(workspace.id, project.id).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
		}
	});

	test("returns empty diffs and zero totals when no changes", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject();

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			workspaceRepo: { listByWorkspace: () => [] } as never,
			worktree: createMockWorktreeRepository(),
			git: createMockGitRepository({
				getDiffs: async () => [],
			}),
		});

		const result = await getDiffs(workspace.id, project.id).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.diffs).toHaveLength(0);
			expect(result.value.totalAdditions).toBe(0);
			expect(result.value.totalDeletions).toBe(0);
		}
	});
});
