import type { BranchStatus, ConflictOp } from "../../src/models/branch-status";
import type { GitDiff } from "../../src/models/git-diff";

/**
 * Create a test BranchStatus with sensible defaults and overrides.
 */
export function createTestBranchStatus(
	overrides: Partial<BranchStatus> = {},
): BranchStatus {
	return {
		branch: "ak-test-branch-1234",
		targetBranch: "main",
		isRebaseInProgress: false,
		isMergeInProgress: false,
		conflictOp: null,
		conflictedFiles: [],
		ahead: 0,
		behind: 0,
		lastCommitHash: "abc123def456",
		lastCommitMessage: "Test commit message",
		prUrl: null,
		prState: null,
		...overrides,
	};
}

/**
 * Create a BranchStatus with conflicts for testing conflict scenarios.
 */
export function createTestBranchStatusWithConflict(
	conflictOp: ConflictOp,
	conflictedFiles: string[] = ["src/index.ts"],
	overrides: Partial<BranchStatus> = {},
): BranchStatus {
	return createTestBranchStatus({
		isRebaseInProgress: conflictOp === "rebase",
		isMergeInProgress: conflictOp === "merge",
		conflictOp,
		conflictedFiles,
		...overrides,
	});
}

/**
 * Create a test GitDiff with sensible defaults and overrides.
 */
export function createTestGitDiff(overrides: Partial<GitDiff> = {}): GitDiff {
	return {
		filePath: "src/index.ts",
		status: "modified",
		additions: 10,
		deletions: 5,
		...overrides,
	};
}

/**
 * Create multiple test GitDiffs for testing diff lists.
 */
export function createTestGitDiffs(
	count: number = 3,
	overrides: Partial<GitDiff> = {},
): GitDiff[] {
	const statuses: GitDiff["status"][] = [
		"added",
		"modified",
		"deleted",
		"renamed",
	];
	return Array.from({ length: count }, (_, i) => ({
		filePath: `src/file${i + 1}.ts`,
		status: statuses[i % statuses.length],
		additions: 10 + i * 5,
		deletions: i * 2,
		...overrides,
	}));
}
