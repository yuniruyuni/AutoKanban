import { describe, expect, test } from "bun:test";
import {
	createTestProject,
	createTestTask,
	createTestWorkspace,
} from "../../../test/factories";
import { createMockContext } from "../../../test/helpers/context";
import {
	createMockGitRepository,
	createMockWorktreeRepository,
} from "../../../test/helpers/git";
import { mergeBranch } from "./merge-branch";

describe("mergeBranch", () => {
	test("successfully fast-forward merges and transitions task to done", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject();
		const task = createTestTask({
			id: workspace.taskId,
			title: "Test Task",
			status: "inreview",
		});

		let upsertedTask: typeof task | undefined;

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			task: {
				get: () => task,
				upsert: (t: typeof task) => {
					upsertedTask = t;
				},
			} as never,
			worktree: createMockWorktreeRepository(),
			git: createMockGitRepository(),
		});

		const result = await mergeBranch({
			workspaceId: workspace.id,
			projectId: project.id,
			targetBranch: "main",
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.success).toBe(true);
		}
		expect(upsertedTask).toBeDefined();
		expect(upsertedTask?.status).toBe("done");
	});

	test("returns MERGE_FAILED when fast-forward is not possible", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject();
		const task = createTestTask({ id: workspace.taskId });

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			task: { get: () => task } as never,
			worktree: createMockWorktreeRepository(),
			git: createMockGitRepository({
				fastForwardMerge: async () => {
					throw new Error("FAST_FORWARD_NOT_POSSIBLE");
				},
			}),
		});

		const result = await mergeBranch({
			workspaceId: workspace.id,
			projectId: project.id,
			targetBranch: "main",
		}).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("MERGE_FAILED");
		}
	});

	test("returns NOT_FOUND when workspace does not exist", async () => {
		const ctx = createMockContext({
			workspace: { get: () => null } as never,
		});

		const result = await mergeBranch({
			workspaceId: "non-existent",
			projectId: "proj-1",
			targetBranch: "main",
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

		const result = await mergeBranch({
			workspaceId: workspace.id,
			projectId: "non-existent",
			targetBranch: "main",
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

		const result = await mergeBranch({
			workspaceId: workspace.id,
			projectId: project.id,
			targetBranch: "main",
		}).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
		}
	});

	test("does not update task status if task not found", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject();

		let upsertCalled = false;

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			task: {
				get: () => null,
				upsert: () => {
					upsertCalled = true;
				},
			} as never,
			worktree: createMockWorktreeRepository(),
			git: createMockGitRepository(),
		});

		const result = await mergeBranch({
			workspaceId: workspace.id,
			projectId: project.id,
			targetBranch: "main",
		}).run(ctx);

		expect(result.ok).toBe(true);
		expect(upsertCalled).toBe(false);
	});

	test("does not update task status if already done", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject();
		const task = createTestTask({
			id: workspace.taskId,
			status: "done",
		});

		let upsertCalled = false;

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			task: {
				get: () => task,
				upsert: () => {
					upsertCalled = true;
				},
			} as never,
			worktree: createMockWorktreeRepository(),
			git: createMockGitRepository(),
		});

		const result = await mergeBranch({
			workspaceId: workspace.id,
			projectId: project.id,
			targetBranch: "main",
		}).run(ctx);

		expect(result.ok).toBe(true);
		expect(upsertCalled).toBe(false);
	});
});
