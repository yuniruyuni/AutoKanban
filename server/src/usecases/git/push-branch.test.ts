import { describe, expect, test } from "bun:test";
import {
	createTestProject,
	createTestWorkspace,
} from "../../../test/factories";
import { createMockContext } from "../../../test/helpers/context";
import {
	createMockGitRepository,
	createMockWorktreeRepository,
} from "../../../test/helpers/git";
import { pushBranch } from "./push-branch";

describe("pushBranch", () => {
	test("successfully pushes branch", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject();

		let pushCalled = false;

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			worktree: createMockWorktreeRepository(),
			git: createMockGitRepository({
				getCurrentBranch: async () => "feature/test",
				push: async () => {
					pushCalled = true;
				},
			}),
		});

		const result = await pushBranch({
			workspaceId: workspace.id,
			projectId: project.id,
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.success).toBe(true);
			expect(result.value.branch).toBe("feature/test");
		}
		expect(pushCalled).toBe(true);
	});

	test("uses default remote origin", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject();

		let capturedRemote: string | undefined;

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			worktree: createMockWorktreeRepository(),
			git: createMockGitRepository({
				getCurrentBranch: async () => "main",
				push: async (_path: string, remote?: string) => {
					capturedRemote = remote;
				},
			}),
		});

		await pushBranch({
			workspaceId: workspace.id,
			projectId: project.id,
		}).run(ctx);

		expect(capturedRemote).toBe("origin");
	});

	test("uses custom remote when provided", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject();

		let capturedRemote: string | undefined;

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			worktree: createMockWorktreeRepository(),
			git: createMockGitRepository({
				getCurrentBranch: async () => "main",
				push: async (_path: string, remote?: string) => {
					capturedRemote = remote;
				},
			}),
		});

		await pushBranch({
			workspaceId: workspace.id,
			projectId: project.id,
			remote: "upstream",
		}).run(ctx);

		expect(capturedRemote).toBe("upstream");
	});

	test("uses force push when specified", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject();

		let capturedForce: boolean | undefined;

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			worktree: createMockWorktreeRepository(),
			git: createMockGitRepository({
				getCurrentBranch: async () => "main",
				push: async (
					_path: string,
					_remote?: string,
					_branch?: string,
					force?: boolean,
				) => {
					capturedForce = force;
				},
			}),
		});

		await pushBranch({
			workspaceId: workspace.id,
			projectId: project.id,
			force: true,
		}).run(ctx);

		expect(capturedForce).toBe(true);
	});

	test("returns NOT_FOUND when workspace does not exist", async () => {
		const ctx = createMockContext({
			workspace: { get: () => null } as never,
		});

		const result = await pushBranch({
			workspaceId: "non-existent",
			projectId: "proj-1",
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

		const result = await pushBranch({
			workspaceId: workspace.id,
			projectId: "non-existent",
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

		const result = await pushBranch({
			workspaceId: workspace.id,
			projectId: project.id,
		}).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
		}
	});

	test("returns INTERNAL error for push failures", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject();

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			worktree: createMockWorktreeRepository(),
			git: createMockGitRepository({
				getCurrentBranch: async () => "main",
				push: async () => {
					throw new Error("Permission denied");
				},
			}),
		});

		const result = await pushBranch({
			workspaceId: workspace.id,
			projectId: project.id,
		}).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("INTERNAL");
		}
	});
});
