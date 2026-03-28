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
import { continueRebase } from "./continue-rebase";

describe("continueRebase", () => {
	test("successfully continues rebase", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject();

		let continueCalled = false;

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			worktree: createMockWorktreeRepository(),
			git: createMockGitRepository({
				isRebaseInProgress: async () => true,
				getConflictedFiles: async () => [],
				continueRebase: async () => {
					continueCalled = true;
				},
			}),
		});

		const result = await continueRebase({
			workspaceId: workspace.id,
			projectId: project.id,
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.success).toBe(true);
			expect(result.value.hasConflicts).toBe(false);
		}
		expect(continueCalled).toBe(true);
	});

	test("returns GIT_ERROR when no rebase in progress", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject();

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			worktree: createMockWorktreeRepository(),
			git: createMockGitRepository({
				isRebaseInProgress: async () => false,
			}),
		});

		const result = await continueRebase({
			workspaceId: workspace.id,
			projectId: project.id,
		}).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("GIT_ERROR");
			expect(result.error.message).toContain("No rebase in progress");
		}
	});

	test("returns GIT_ERROR when conflicts remain", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject();

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			worktree: createMockWorktreeRepository(),
			git: createMockGitRepository({
				isRebaseInProgress: async () => true,
				getConflictedFiles: async () => ["src/index.ts", "src/utils.ts"],
			}),
		});

		const result = await continueRebase({
			workspaceId: workspace.id,
			projectId: project.id,
		}).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("GIT_ERROR");
			expect(result.error.message).toContain("conflicts remain");
			expect(result.error.message).toContain("src/index.ts");
		}
	});

	test("handles new conflicts during continue", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject();

		// First call returns no conflicts (read step), second call returns new conflicts (write step)
		let callCount = 0;

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			worktree: createMockWorktreeRepository(),
			git: createMockGitRepository({
				isRebaseInProgress: async () => true,
				getConflictedFiles: async () => {
					callCount++;
					// First call (in read) returns no conflicts
					// Second call (in write after error) returns new conflicts
					return callCount === 1 ? [] : ["new-conflict.ts"];
				},
				continueRebase: async () => {
					throw new Error("conflict detected");
				},
			}),
		});

		const result = await continueRebase({
			workspaceId: workspace.id,
			projectId: project.id,
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.success).toBe(false);
			expect(result.value.hasConflicts).toBe(true);
			expect(result.value.conflictedFiles).toEqual(["new-conflict.ts"]);
		}
	});

	test("returns NOT_FOUND when workspace does not exist", async () => {
		const ctx = createMockContext({
			workspace: { get: () => null } as never,
		});

		const result = await continueRebase({
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

		const result = await continueRebase({
			workspaceId: workspace.id,
			projectId: "non-existent",
		}).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
		}
	});
});
