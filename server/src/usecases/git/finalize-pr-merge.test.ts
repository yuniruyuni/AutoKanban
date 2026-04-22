import { describe, expect, test } from "bun:test";
import {
	createTestProject,
	createTestTask,
	createTestWorkspace,
	createTestWorkspaceRepo,
} from "../../../test/factories";
import { createMockContext } from "../../../test/helpers/context";
import {
	createMockGitRepository,
	createMockWorktreeRepository,
} from "../../../test/helpers/git";
import { finalizePrMerge } from "./finalize-pr-merge";

describe("finalizePrMerge", () => {
	test("pulls default branch, marks task done, removes worktree when PR is merged", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject();
		const task = createTestTask({
			id: workspace.taskId,
			projectId: project.id,
			status: "inreview",
		});
		const workspaceRepo = createTestWorkspaceRepo({
			workspaceId: workspace.id,
			projectId: project.id,
			prUrl: "https://github.com/test/repo/pull/1",
		});

		let pullBranchCalled = false;
		let taskUpsertedStatus = "" as string;
		let worktreeRemoved = false;

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			task: {
				get: () => task,
				upsert: (t: { status: string }) => {
					taskUpsertedStatus = t.status;
				},
			} as never,
			workspaceRepo: {
				listByWorkspace: () => [workspaceRepo],
			} as never,
			worktree: createMockWorktreeRepository({
				removeWorktree: async () => {
					worktreeRemoved = true;
				},
			}),
			git: createMockGitRepository({
				getPrStatus: async () => ({
					state: "merged" as const,
					mergedAt: "2025-01-15T10:00:00Z",
				}),
				pullBranch: async () => {
					pullBranchCalled = true;
				},
			}),
		});

		const result = await finalizePrMerge(workspace.id, project.id).run(ctx);

		expect(result.ok).toBe(true);
		expect(pullBranchCalled).toBe(true);
		expect(taskUpsertedStatus).toBe("done");
		expect(worktreeRemoved).toBe(true);
	});

	test("returns VALIDATION error when PR is not merged", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject();
		const task = createTestTask({
			id: workspace.taskId,
			projectId: project.id,
			status: "inreview",
		});
		const workspaceRepo = createTestWorkspaceRepo({
			workspaceId: workspace.id,
			projectId: project.id,
			prUrl: "https://github.com/test/repo/pull/1",
		});

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			task: { get: () => task } as never,
			workspaceRepo: {
				listByWorkspace: () => [workspaceRepo],
			} as never,
			git: createMockGitRepository({
				getPrStatus: async () => ({ state: "open" as const, mergedAt: null }),
			}),
		});

		const result = await finalizePrMerge(workspace.id, project.id).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("VALIDATION");
		}
	});

	test("returns NOT_FOUND when workspace does not exist", async () => {
		const ctx = createMockContext({
			workspace: { get: () => null } as never,
		});

		const result = await finalizePrMerge("non-existent", "proj-1").run(ctx);

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

		const result = await finalizePrMerge(workspace.id, "non-existent").run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
		}
	});

	test("is idempotent when task is already done", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject();
		const task = createTestTask({
			id: workspace.taskId,
			projectId: project.id,
			status: "done",
		});

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			task: { get: () => task } as never,
		});

		const result = await finalizePrMerge(workspace.id, project.id).run(ctx);

		expect(result.ok).toBe(true);
	});
});
