import { describe, expect, test } from "bun:test";
import {
	createTestProject,
	createTestWorkspace,
} from "../../../test/factories";
import { createTestBranchStatus } from "../../../test/factories/git";
import { createMockContext } from "../../../test/helpers/context";
import {
	createMockGitRepository,
	createMockWorktreeRepository,
} from "../../../test/helpers/git";
import { getBranchStatus } from "./get-branch-status";

describe("getBranchStatus", () => {
	test("returns branch status for valid workspace and project", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject({ id: "proj-1" });
		const expectedStatus = createTestBranchStatus({ ahead: 3, behind: 1 });

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			workspaceRepo: { listByWorkspace: () => [] } as never,
			worktree: createMockWorktreeRepository({
				worktreeExists: async () => true,
				getWorktreePath: () => "/tmp/worktree",
			}),
			git: createMockGitRepository({
				getBranchStatus: async () => expectedStatus,
			}),
		});

		const result = await getBranchStatus({
			workspaceId: workspace.id,
			projectId: project.id,
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.ahead).toBe(3);
			expect(result.value.behind).toBe(1);
		}
	});

	test("uses workspace repo targetBranch when available", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject({ id: "proj-1", branch: "main" });
		const workspaceRepo = {
			projectId: project.id,
			targetBranch: "feature/custom",
		};

		let capturedTargetBranch: string | undefined;

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			workspaceRepo: { listByWorkspace: () => [workspaceRepo] } as never,
			worktree: createMockWorktreeRepository(),
			git: createMockGitRepository({
				getBranchStatus: async (_path: string, target: string) => {
					capturedTargetBranch = target;
					return createTestBranchStatus();
				},
			}),
		});

		await getBranchStatus({
			workspaceId: workspace.id,
			projectId: project.id,
		}).run(ctx);

		expect(capturedTargetBranch).toBe("feature/custom");
	});

	test("falls back to project.branch when no workspace repo", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject({ id: "proj-1", branch: "develop" });

		let capturedTargetBranch: string | undefined;

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			workspaceRepo: { listByWorkspace: () => [] } as never,
			worktree: createMockWorktreeRepository(),
			git: createMockGitRepository({
				getBranchStatus: async (_path: string, target: string) => {
					capturedTargetBranch = target;
					return createTestBranchStatus();
				},
			}),
		});

		await getBranchStatus({
			workspaceId: workspace.id,
			projectId: project.id,
		}).run(ctx);

		expect(capturedTargetBranch).toBe("develop");
	});

	test("returns NOT_FOUND when workspace does not exist", async () => {
		const ctx = createMockContext({
			workspace: { get: () => null } as never,
		});

		const result = await getBranchStatus({
			workspaceId: "non-existent",
			projectId: "proj-1",
		}).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
			expect(result.error.message).toContain("Workspace not found");
		}
	});

	test("returns NOT_FOUND when project does not exist", async () => {
		const workspace = createTestWorkspace();

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => null } as never,
		});

		const result = await getBranchStatus({
			workspaceId: workspace.id,
			projectId: "non-existent",
		}).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
			expect(result.error.message).toContain("Project not found");
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

		const result = await getBranchStatus({
			workspaceId: workspace.id,
			projectId: project.id,
		}).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
			expect(result.error.message).toContain("Worktree does not exist");
		}
	});
});
