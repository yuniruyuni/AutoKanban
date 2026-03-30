import type { BranchStatus, ConflictOp } from "../../models/branch-status";
import type { GitDiff } from "../../models/git-diff";
import type { ServiceCtx } from "../common";

export interface GitRepository {
	// Worktree operations
	addWorktree(
		ctx: ServiceCtx,
		repoPath: string,
		worktreePath: string,
		branch: string,
		createBranch?: boolean,
	): Promise<void>;
	removeWorktree(
		ctx: ServiceCtx,
		repoPath: string,
		worktreePath: string,
		force?: boolean,
	): Promise<void>;
	pruneWorktrees(ctx: ServiceCtx, repoPath: string): Promise<void>;

	// Branch operations
	getCurrentBranch(ctx: ServiceCtx, worktreePath: string): Promise<string>;
	branchExists(
		ctx: ServiceCtx,
		repoPath: string,
		branch: string,
	): Promise<boolean>;
	getAheadBehind(
		ctx: ServiceCtx,
		worktreePath: string,
		branch: string,
		targetBranch: string,
	): Promise<{ ahead: number; behind: number }>;
	listBranches(
		ctx: ServiceCtx,
		repoPath: string,
	): Promise<{ name: string; isCurrent: boolean }[]>;

	// Rebase/Merge operations
	rebaseBranch(
		ctx: ServiceCtx,
		worktreePath: string,
		newBase: string,
		oldBase?: string,
	): Promise<string>;
	fastForwardMerge(
		ctx: ServiceCtx,
		worktreePath: string,
		targetBranch: string,
	): Promise<void>;
	abortRebase(ctx: ServiceCtx, worktreePath: string): Promise<void>;
	continueRebase(ctx: ServiceCtx, worktreePath: string): Promise<void>;
	abortMerge(ctx: ServiceCtx, worktreePath: string): Promise<void>;

	// Conflict detection
	isRebaseInProgress(ctx: ServiceCtx, worktreePath: string): Promise<boolean>;
	isMergeInProgress(ctx: ServiceCtx, worktreePath: string): Promise<boolean>;
	getConflictedFiles(ctx: ServiceCtx, worktreePath: string): Promise<string[]>;
	detectConflictOp(
		ctx: ServiceCtx,
		worktreePath: string,
	): Promise<ConflictOp | null>;

	// Diff operations
	getDiffs(
		ctx: ServiceCtx,
		worktreePath: string,
		baseCommit: string,
	): Promise<GitDiff[]>;
	getUnifiedDiff(
		ctx: ServiceCtx,
		worktreePath: string,
		baseCommit: string,
	): Promise<string>;
	getFileDiff(
		ctx: ServiceCtx,
		worktreePath: string,
		baseCommit: string,
		filePath: string,
	): Promise<string>;

	// Commit operations
	getLastCommit(
		ctx: ServiceCtx,
		worktreePath: string,
	): Promise<{ hash: string; message: string } | null>;
	stageAll(ctx: ServiceCtx, worktreePath: string): Promise<void>;
	commit(ctx: ServiceCtx, worktreePath: string, message: string): Promise<void>;

	// Push operations
	push(
		ctx: ServiceCtx,
		worktreePath: string,
		remote?: string,
		branch?: string,
		force?: boolean,
	): Promise<void>;

	// PR operations
	createPullRequest(
		ctx: ServiceCtx,
		worktreePath: string,
		title: string,
		body: string,
		baseBranch: string,
		draft?: boolean,
	): Promise<{ url: string }>;

	// Branch status
	getBranchStatus(
		ctx: ServiceCtx,
		worktreePath: string,
		targetBranch: string,
	): Promise<BranchStatus>;

	// PR status
	getPrStatus(
		ctx: ServiceCtx,
		repoPath: string,
		prUrl: string,
	): Promise<{
		state: "open" | "closed" | "merged";
		mergedAt: string | null;
	}>;

	// Pull branch (fetch + update-ref)
	pullBranch(
		ctx: ServiceCtx,
		repoPath: string,
		branch: string,
		remote?: string,
	): Promise<void>;

	// Helper methods
	fetch(ctx: ServiceCtx, worktreePath: string, remote?: string): Promise<void>;
	isGitRepo(ctx: ServiceCtx, dirPath: string): Promise<boolean>;
}
