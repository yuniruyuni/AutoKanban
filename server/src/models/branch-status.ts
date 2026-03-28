// ============================================
// BranchStatus - Git branch status for a worktree
// ============================================

export type ConflictOp = "rebase" | "merge" | "cherryPick" | "revert";

export type PrState = "open" | "closed" | "merged";

export interface BranchStatus {
	// Current branch state
	branch: string;
	targetBranch: string;

	// Rebase/merge state
	isRebaseInProgress: boolean;
	isMergeInProgress: boolean;
	conflictOp: ConflictOp | null;
	conflictedFiles: string[];

	// Ahead/behind counts relative to target branch
	ahead: number; // How many commits ahead of target branch
	behind: number; // How many commits behind target branch

	// Last commit info
	lastCommitHash: string | null;
	lastCommitMessage: string | null;

	// PR info
	prUrl: string | null;
	prState: PrState | null;
}

export function createBranchStatus(params: {
	branch: string;
	targetBranch: string;
	isRebaseInProgress?: boolean;
	isMergeInProgress?: boolean;
	conflictOp?: ConflictOp | null;
	conflictedFiles?: string[];
	ahead?: number;
	behind?: number;
	lastCommitHash?: string | null;
	lastCommitMessage?: string | null;
	prUrl?: string | null;
	prState?: PrState | null;
}): BranchStatus {
	return {
		branch: params.branch,
		targetBranch: params.targetBranch,
		isRebaseInProgress: params.isRebaseInProgress ?? false,
		isMergeInProgress: params.isMergeInProgress ?? false,
		conflictOp: params.conflictOp ?? null,
		conflictedFiles: params.conflictedFiles ?? [],
		ahead: params.ahead ?? 0,
		behind: params.behind ?? 0,
		lastCommitHash: params.lastCommitHash ?? null,
		lastCommitMessage: params.lastCommitMessage ?? null,
		prUrl: params.prUrl ?? null,
		prState: params.prState ?? null,
	};
}

export function hasConflicts(status: BranchStatus): boolean {
	return status.conflictedFiles.length > 0;
}

export function needsSync(status: BranchStatus): boolean {
	return status.behind > 0;
}
