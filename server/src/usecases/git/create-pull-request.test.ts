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
import { createPullRequest } from "./create-pull-request";

describe("createPullRequest", () => {
	test("pushes and creates PR successfully", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject();

		let pushCalled = false;
		let prCreated = false;

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			worktree: createMockWorktreeRepository(),
			workspaceRepo: { listByWorkspace: () => [], upsert: () => {} } as never,
			draftPullRequest: {
				get: () => ({
					workspaceId: workspace.id,
					projectId: project.id,
					status: "completed",
					title: "Generated Title",
					body: "Generated Body",
					logs: "",
					createdAt: new Date(),
					updatedAt: new Date(),
				}),
				delete: () => true,
			} as never,
			git: createMockGitRepository({
				getCurrentBranch: async () => "feature/test",
				push: async () => {
					pushCalled = true;
				},
				createPullRequest: async () => {
					prCreated = true;
					return { url: "https://github.com/test/repo/pull/42" };
				},
			}),
		});

		const result = await createPullRequest(
			workspace.id,
			project.id,
			"My Task",
		).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.success).toBe(true);
			expect(result.value.branch).toBe("feature/test");
			expect(result.value.prUrl).toBe("https://github.com/test/repo/pull/42");
		}
		expect(pushCalled).toBe(true);
		expect(prCreated).toBe(true);
	});

	test("uses workspace repo targetBranch as PR base", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject();

		let capturedBase: string | undefined;

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			worktree: createMockWorktreeRepository(),
			workspaceRepo: {
				listByWorkspace: () => [
					{ projectId: project.id, targetBranch: "develop" },
				],
				upsert: () => {},
			} as never,
			draftPullRequest: {
				get: () => undefined,
				delete: () => true,
			} as never,
			git: createMockGitRepository({
				getCurrentBranch: async () => "feature/test",
				createPullRequest: async (
					_path: string,
					_title: string,
					_body: string,
					baseBranch: string,
				) => {
					capturedBase = baseBranch;
					return { url: "https://github.com/test/repo/pull/1" };
				},
			}),
		});

		await createPullRequest(workspace.id, project.id, "My Task").run(ctx);

		expect(capturedBase).toBe("develop");
	});

	test("returns NOT_FOUND when workspace does not exist", async () => {
		const ctx = createMockContext({
			workspace: { get: () => null } as never,
		});

		const result = await createPullRequest(
			"non-existent",
			"proj-1",
			"Task",
		).run(ctx);

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

		const result = await createPullRequest(
			workspace.id,
			"non-existent",
			"Task",
		).run(ctx);

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

		const result = await createPullRequest(
			workspace.id,
			project.id,
			"Task",
		).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
		}
	});

	test("returns INTERNAL error when push fails", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject();

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			worktree: createMockWorktreeRepository(),
			workspaceRepo: { listByWorkspace: () => [], upsert: () => {} } as never,
			git: createMockGitRepository({
				getCurrentBranch: async () => "main",
				push: async () => {
					throw new Error("Permission denied");
				},
			}),
		});

		const result = await createPullRequest(
			workspace.id,
			project.id,
			"Task",
		).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("INTERNAL");
		}
	});

	test("returns INTERNAL error when gh pr create fails", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject();

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			worktree: createMockWorktreeRepository(),
			workspaceRepo: { listByWorkspace: () => [], upsert: () => {} } as never,
			git: createMockGitRepository({
				getCurrentBranch: async () => "main",
				createPullRequest: async () => {
					throw new Error("gh: not authenticated");
				},
			}),
		});

		const result = await createPullRequest(
			workspace.id,
			project.id,
			"Task",
		).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("INTERNAL");
		}
	});
});
