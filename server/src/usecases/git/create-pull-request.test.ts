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
			session: { list: () => ({ items: [], hasMore: false }) } as never,
			codingAgentTurn: {
				findLatestResumeInfoByWorkspaceId: () => null,
			} as never,
			executor: {
				startProtocolAndWait: async () => ({ exitCode: 1 }),
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

		const result = await createPullRequest({
			workspaceId: workspace.id,
			projectId: project.id,
			taskTitle: "My Task",
		}).run(ctx);

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
			session: { list: () => ({ items: [], hasMore: false }) } as never,
			codingAgentTurn: {
				findLatestResumeInfoByWorkspaceId: () => null,
			} as never,
			executor: {
				startProtocolAndWait: async () => ({ exitCode: 1 }),
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

		await createPullRequest({
			workspaceId: workspace.id,
			projectId: project.id,
			taskTitle: "My Task",
		}).run(ctx);

		expect(capturedBase).toBe("develop");
	});

	test("returns NOT_FOUND when workspace does not exist", async () => {
		const ctx = createMockContext({
			workspace: { get: () => null } as never,
		});

		const result = await createPullRequest({
			workspaceId: "non-existent",
			projectId: "proj-1",
			taskTitle: "Task",
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

		const result = await createPullRequest({
			workspaceId: workspace.id,
			projectId: "non-existent",
			taskTitle: "Task",
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

		const result = await createPullRequest({
			workspaceId: workspace.id,
			projectId: project.id,
			taskTitle: "Task",
		}).run(ctx);

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

		const result = await createPullRequest({
			workspaceId: workspace.id,
			projectId: project.id,
			taskTitle: "Task",
		}).run(ctx);

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

		const result = await createPullRequest({
			workspaceId: workspace.id,
			projectId: project.id,
			taskTitle: "Task",
		}).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("INTERNAL");
		}
	});
});
