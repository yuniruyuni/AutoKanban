import type { ConflictOp } from "../../src/models/branch-status";
import type { Project } from "../../src/models/project";
import type { Workspace } from "../../src/models/workspace";
import type {
	IGitRepository,
	IWorktreeRepository,
} from "../../src/types/repository";
import { createTestBranchStatus, createTestGitDiffs } from "../factories/git";

/**
 * Create a mock IGitRepository for testing.
 * All methods return sensible defaults that can be overridden.
 */
export function createMockGitRepository(
	overrides: Partial<IGitRepository> = {},
): IGitRepository {
	return {
		// Worktree operations
		addWorktree: async () => {},
		removeWorktree: async () => {},
		pruneWorktrees: async () => {},

		// Branch operations
		getCurrentBranch: async () => "ak-test-branch",
		branchExists: async () => false,
		getAheadBehind: async () => ({ ahead: 0, behind: 0 }),
		listBranches: async () => [
			{ name: "main", isCurrent: false },
			{ name: "ak-test-branch", isCurrent: true },
		],

		// Rebase/Merge operations
		rebaseBranch: async () => "Successfully rebased",
		fastForwardMerge: async () => {},
		abortRebase: async () => {},
		continueRebase: async () => {},
		abortMerge: async () => {},

		// Conflict detection
		isRebaseInProgress: async () => false,
		isMergeInProgress: async () => false,
		getConflictedFiles: async () => [],
		detectConflictOp: async () => null,

		// Diff operations
		getDiffs: async () => createTestGitDiffs(3),
		getUnifiedDiff: async () =>
			"--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1,3 +1,4 @@\n+// added line\n export function main() {}",
		getFileDiff: async () =>
			"--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1,3 +1,4 @@\n+// added line\n export function main() {}",

		// Commit operations
		getLastCommit: async () => ({
			hash: "abc123def456",
			message: "Test commit",
		}),
		stageAll: async () => {},
		commit: async () => {},

		// Push operations
		push: async () => {},

		// PR operations
		createPullRequest: async () => ({
			url: "https://github.com/test/repo/pull/1",
		}),

		// Branch status
		getBranchStatus: async () => createTestBranchStatus(),

		// PR status
		getPrStatus: async () => ({ state: "open" as const, mergedAt: null }),
		pullBranch: async () => {},

		// Helper methods
		fetch: async () => {},
		isGitRepo: async () => true,

		...overrides,
	};
}

/**
 * Create a mock IGitRepository configured to simulate rebase conflicts.
 */
export function createMockGitRepositoryWithRebaseConflict(
	conflictedFiles: string[] = ["src/index.ts"],
	overrides: Partial<IGitRepository> = {},
): IGitRepository {
	return createMockGitRepository({
		isRebaseInProgress: async () => true,
		getConflictedFiles: async () => conflictedFiles,
		detectConflictOp: async () => "rebase" as ConflictOp,
		getBranchStatus: async () =>
			createTestBranchStatus({
				isRebaseInProgress: true,
				conflictOp: "rebase",
				conflictedFiles,
			}),
		rebaseBranch: async () => {
			throw new Error("REBASE_CONFLICT");
		},
		...overrides,
	});
}

/**
 * Create a mock IWorktreeRepository for testing.
 * All methods return sensible defaults that can be overridden.
 */
export function createMockWorktreeRepository(
	overrides: Partial<IWorktreeRepository> = {},
): IWorktreeRepository {
	const baseDir = "/tmp/worktrees";

	return {
		getBaseDir: () => baseDir,
		getWorkspaceDir: (workspaceId: string) => `${baseDir}/${workspaceId}`,
		getWorktreePath: (workspaceId: string, projectName: string) =>
			`${baseDir}/${workspaceId}/${projectName}`,
		createWorktree: async (workspace: Workspace, project: Project) =>
			`${baseDir}/${workspace.id}/${project.name}`,
		removeWorktree: async () => {},
		removeAllWorktrees: async () => {},
		worktreeExists: async () => true,
		ensureWorktreeExists: async (workspace: Workspace, project: Project) =>
			`${baseDir}/${workspace.id}/${project.name}`,
		getWorktreeInfo: async () => [],
		pruneWorktrees: async () => {},

		...overrides,
	};
}

/**
 * Create a mock IWorktreeRepository that simulates non-existent worktrees.
 */
export function createMockWorktreeRepositoryNotExists(
	overrides: Partial<IWorktreeRepository> = {},
): IWorktreeRepository {
	return createMockWorktreeRepository({
		worktreeExists: async () => false,
		...overrides,
	});
}

/**
 * Create a mock IWorktreeRepository that throws on worktree creation.
 */
export function createMockWorktreeRepositoryCreationFails(
	errorMessage: string = "Permission denied",
	overrides: Partial<IWorktreeRepository> = {},
): IWorktreeRepository {
	return createMockWorktreeRepository({
		createWorktree: async () => {
			throw new Error(errorMessage);
		},
		ensureWorktreeExists: async () => {
			throw new Error(errorMessage);
		},
		...overrides,
	});
}
