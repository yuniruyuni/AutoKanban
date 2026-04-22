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
import { abortRebase } from "./abort-rebase";

describe("abortRebase", () => {
	test("successfully aborts rebase", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject();

		let abortCalled = false;

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			worktree: createMockWorktreeRepository(),
			git: createMockGitRepository({
				isRebaseInProgress: async () => true,
				abortRebase: async () => {
					abortCalled = true;
				},
			}),
		});

		const result = await abortRebase(workspace.id, project.id).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.success).toBe(true);
		}
		expect(abortCalled).toBe(true);
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

		const result = await abortRebase(workspace.id, project.id).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("GIT_ERROR");
			expect(result.error.message).toContain("No rebase in progress");
		}
	});

	test("returns NOT_FOUND when workspace does not exist", async () => {
		const ctx = createMockContext({
			workspace: { get: () => null } as never,
		});

		const result = await abortRebase("non-existent", "proj-1").run(ctx);

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

		const result = await abortRebase(workspace.id, "non-existent").run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
		}
	});

	test("returns INTERNAL error for abort failures", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject();

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			worktree: createMockWorktreeRepository(),
			git: createMockGitRepository({
				isRebaseInProgress: async () => true,
				abortRebase: async () => {
					throw new Error("Git error");
				},
			}),
		});

		const result = await abortRebase(workspace.id, project.id).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("INTERNAL");
		}
	});
});
