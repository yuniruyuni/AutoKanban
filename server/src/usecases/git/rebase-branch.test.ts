import { describe, expect, test } from "bun:test";
import {
	createTestProject,
	createTestWorkspace,
} from "../../../test/factories";
import { createMockContext } from "../../../test/helpers/context";
import {
	createMockGitRepository,
	createMockGitRepositoryWithRebaseConflict,
	createMockWorktreeRepository,
} from "../../../test/helpers/git";
import { rebaseBranch } from "./rebase-branch";

describe("rebaseBranch", () => {
	test("successfully rebases branch onto new base", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject();

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			worktree: createMockWorktreeRepository(),
			git: createMockGitRepository({
				fetch: async () => {},
				rebaseBranch: async () => "Successfully rebased",
			}),
		});

		const result = await rebaseBranch({
			workspaceId: workspace.id,
			projectId: project.id,
			newBaseBranch: "main",
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.success).toBe(true);
			expect(result.value.hasConflicts).toBe(false);
		}
	});

	test("returns conflict info when rebase has conflicts", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject();
		const conflictedFiles = ["src/index.ts", "src/utils.ts"];

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			worktree: createMockWorktreeRepository(),
			git: createMockGitRepositoryWithRebaseConflict(conflictedFiles),
		});

		const result = await rebaseBranch({
			workspaceId: workspace.id,
			projectId: project.id,
			newBaseBranch: "main",
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.success).toBe(false);
			expect(result.value.hasConflicts).toBe(true);
			expect(result.value.conflictedFiles).toEqual(conflictedFiles);
		}
	});

	test("fetches before rebasing", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject();

		let fetchCalled = false;
		let rebaseCalled = false;
		const callOrder: string[] = [];

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			worktree: createMockWorktreeRepository(),
			git: createMockGitRepository({
				fetch: async () => {
					fetchCalled = true;
					callOrder.push("fetch");
				},
				rebaseBranch: async () => {
					rebaseCalled = true;
					callOrder.push("rebase");
					return "rebased";
				},
			}),
		});

		await rebaseBranch({
			workspaceId: workspace.id,
			projectId: project.id,
			newBaseBranch: "main",
		}).run(ctx);

		expect(fetchCalled).toBe(true);
		expect(rebaseCalled).toBe(true);
		expect(callOrder).toEqual(["fetch", "rebase"]);
	});

	test("returns NOT_FOUND when workspace does not exist", async () => {
		const ctx = createMockContext({
			workspace: { get: () => null } as never,
		});

		const result = await rebaseBranch({
			workspaceId: "non-existent",
			projectId: "proj-1",
			newBaseBranch: "main",
		}).run(ctx);

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

		const result = await rebaseBranch({
			workspaceId: workspace.id,
			projectId: "non-existent",
			newBaseBranch: "main",
		}).run(ctx);

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
			worktree: createMockWorktreeRepository({
				worktreeExists: async () => false,
			}),
		});

		const result = await rebaseBranch({
			workspaceId: workspace.id,
			projectId: project.id,
			newBaseBranch: "main",
		}).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
		}
	});

	test("returns INTERNAL error for non-conflict errors", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject();

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			worktree: createMockWorktreeRepository(),
			git: createMockGitRepository({
				fetch: async () => {},
				rebaseBranch: async () => {
					throw new Error("Network error");
				},
			}),
		});

		const result = await rebaseBranch({
			workspaceId: workspace.id,
			projectId: project.id,
			newBaseBranch: "main",
		}).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("INTERNAL");
		}
	});
});
