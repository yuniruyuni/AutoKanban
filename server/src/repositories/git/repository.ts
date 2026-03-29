import type { BranchStatus, ConflictOp } from "../../models/branch-status";
import type { GitDiff } from "../../models/git-diff";

export interface IGitRepository {
	// Worktree operations
	addWorktree(
		repoPath: string,
		worktreePath: string,
		branch: string,
		createBranch?: boolean,
	): Promise<void>;
	removeWorktree(
		repoPath: string,
		worktreePath: string,
		force?: boolean,
	): Promise<void>;
	pruneWorktrees(repoPath: string): Promise<void>;

	// Branch operations
	getCurrentBranch(worktreePath: string): Promise<string>;
	branchExists(repoPath: string, branch: string): Promise<boolean>;
	getAheadBehind(
		worktreePath: string,
		branch: string,
		targetBranch: string,
	): Promise<{ ahead: number; behind: number }>;
	listBranches(
		repoPath: string,
	): Promise<{ name: string; isCurrent: boolean }[]>;

	// Rebase/Merge operations
	rebaseBranch(
		worktreePath: string,
		newBase: string,
		oldBase?: string,
	): Promise<string>;
	fastForwardMerge(worktreePath: string, targetBranch: string): Promise<void>;
	abortRebase(worktreePath: string): Promise<void>;
	continueRebase(worktreePath: string): Promise<void>;
	abortMerge(worktreePath: string): Promise<void>;

	// Conflict detection
	isRebaseInProgress(worktreePath: string): Promise<boolean>;
	isMergeInProgress(worktreePath: string): Promise<boolean>;
	getConflictedFiles(worktreePath: string): Promise<string[]>;
	detectConflictOp(worktreePath: string): Promise<ConflictOp | null>;

	// Diff operations
	getDiffs(worktreePath: string, baseCommit: string): Promise<GitDiff[]>;
	getUnifiedDiff(worktreePath: string, baseCommit: string): Promise<string>;
	getFileDiff(
		worktreePath: string,
		baseCommit: string,
		filePath: string,
	): Promise<string>;

	// Commit operations
	getLastCommit(
		worktreePath: string,
	): Promise<{ hash: string; message: string } | null>;
	stageAll(worktreePath: string): Promise<void>;
	commit(worktreePath: string, message: string): Promise<void>;

	// Push operations
	push(
		worktreePath: string,
		remote?: string,
		branch?: string,
		force?: boolean,
	): Promise<void>;

	// PR operations
	createPullRequest(
		worktreePath: string,
		title: string,
		body: string,
		baseBranch: string,
		draft?: boolean,
	): Promise<{ url: string }>;

	// Branch status
	getBranchStatus(
		worktreePath: string,
		targetBranch: string,
	): Promise<BranchStatus>;

	// PR status
	getPrStatus(
		repoPath: string,
		prUrl: string,
	): Promise<{
		state: "open" | "closed" | "merged";
		mergedAt: string | null;
	}>;

	// Pull branch (fetch + update-ref)
	pullBranch(repoPath: string, branch: string, remote?: string): Promise<void>;

	// Helper methods
	fetch(worktreePath: string, remote?: string): Promise<void>;
	isGitRepo(dirPath: string): Promise<boolean>;
}
