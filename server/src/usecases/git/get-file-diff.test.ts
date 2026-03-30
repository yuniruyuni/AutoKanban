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
import { getFileDiff } from "./get-file-diff";

describe("getFileDiff", () => {
	test("returns file diff for valid inputs", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject();
		const expectedDiff =
			"--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1,3 +1,4 @@\n+// new line\n export const x = 1;";

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			workspaceRepo: { listByWorkspace: () => [] } as never,
			worktree: createMockWorktreeRepository(),
			git: createMockGitRepository({
				getFileDiff: async () => expectedDiff,
			}),
		});

		const result = await getFileDiff({
			workspaceId: workspace.id,
			projectId: project.id,
			filePath: "src/index.ts",
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toBe(expectedDiff);
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
				getFileDiff: async (_path: string, baseCommit: string) => {
					capturedBaseCommit = baseCommit;
					return "diff";
				},
			}),
		});

		await getFileDiff({
			workspaceId: workspace.id,
			projectId: project.id,
			filePath: "src/index.ts",
			baseCommit: "abc123",
		}).run(ctx);

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
				getFileDiff: async (_path: string, baseCommit: string) => {
					capturedBaseCommit = baseCommit;
					return "diff";
				},
			}),
		});

		await getFileDiff({
			workspaceId: workspace.id,
			projectId: project.id,
			filePath: "src/index.ts",
		}).run(ctx);

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
				getFileDiff: async (_path: string, baseCommit: string) => {
					capturedBaseCommit = baseCommit;
					return "diff";
				},
			}),
		});

		await getFileDiff({
			workspaceId: workspace.id,
			projectId: project.id,
			filePath: "src/index.ts",
		}).run(ctx);

		expect(capturedBaseCommit).toBe("develop");
	});

	test("passes correct file path", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject();

		let capturedFilePath: string | undefined;

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			workspaceRepo: { listByWorkspace: () => [] } as never,
			worktree: createMockWorktreeRepository(),
			git: createMockGitRepository({
				getFileDiff: async (
					_worktreePath: string,
					_baseCommit: string,
					filePath: string,
				) => {
					capturedFilePath = filePath;
					return "diff";
				},
			}),
		});

		await getFileDiff({
			workspaceId: workspace.id,
			projectId: project.id,
			filePath: "src/components/Button.tsx",
		}).run(ctx);

		expect(capturedFilePath).toBe("src/components/Button.tsx");
	});

	test("returns NOT_FOUND when workspace does not exist", async () => {
		const ctx = createMockContext({
			workspace: { get: () => null } as never,
		});

		const result = await getFileDiff({
			workspaceId: "non-existent",
			projectId: "proj-1",
			filePath: "src/index.ts",
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

		const result = await getFileDiff({
			workspaceId: workspace.id,
			projectId: "non-existent",
			filePath: "src/index.ts",
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
			workspaceRepo: { listByWorkspace: () => [] } as never,
			worktree: createMockWorktreeRepository({
				worktreeExists: async () => false,
			}),
		});

		const result = await getFileDiff({
			workspaceId: workspace.id,
			projectId: project.id,
			filePath: "src/index.ts",
		}).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
		}
	});

	test("returns empty diff when file has no changes", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject();

		const ctx = createMockContext({
			workspace: { get: () => workspace } as never,
			project: { get: () => project } as never,
			workspaceRepo: { listByWorkspace: () => [] } as never,
			worktree: createMockWorktreeRepository(),
			git: createMockGitRepository({
				getFileDiff: async () => "",
			}),
		});

		const result = await getFileDiff({
			workspaceId: workspace.id,
			projectId: project.id,
			filePath: "src/index.ts",
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toBe("");
		}
	});
});
