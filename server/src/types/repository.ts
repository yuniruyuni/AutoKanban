// Repository interfaces - no bun:sqlite dependency
// These interfaces define the contract for data access and external system calls

import type { Approval } from "../models/approval";
import type { BranchStatus, ConflictOp } from "../models/branch-status";
import type { LogStoreSubscription, PendingPermission } from "../models/common";
import type { GitDiff } from "../models/git-diff";
import type { Project } from "../models/project";
import type { Workspace } from "../models/workspace";
import type { WorktreeInfo } from "../models/worktree-info";

export type { ICodingAgentTurnRepository } from "../repositories/coding-agent-turn/repository";
export type { IExecutionProcessRepository } from "../repositories/execution-process/repository";
export type { IExecutionProcessLogsRepository } from "../repositories/execution-process-logs/repository";
export type { IProjectRepository } from "../repositories/project/repository";
export type { ISessionRepository } from "../repositories/session/repository";
export type { ITaskRepository } from "../repositories/task/repository";
export type { ITaskTemplateRepository } from "../repositories/task-template/repository";
export type { IToolRepository } from "../repositories/tool/repository";
export type { IVariantRepository } from "../repositories/variant/repository";
export type { IWorkspaceRepository } from "../repositories/workspace/repository";
export type { IWorkspaceRepoRepository } from "../repositories/workspace-repo/repository";

// ============================================
// External System Repositories
// ============================================

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

export interface IWorktreeRepository {
	getBaseDir(): string;
	getWorkspaceDir(workspaceId: string): string;
	getWorktreePath(workspaceId: string, projectName: string): string;
	createWorktree(
		workspace: Workspace,
		project: Project,
		targetBranch?: string,
	): Promise<string>;
	removeWorktree(
		workspaceId: string,
		project: Project,
		force?: boolean,
		deleteBranch?: boolean,
	): Promise<void>;
	removeAllWorktrees(
		workspaceId: string,
		projects: Project[],
		force?: boolean,
		deleteBranch?: boolean,
	): Promise<void>;
	worktreeExists(workspaceId: string, projectName: string): Promise<boolean>;
	ensureWorktreeExists(
		workspace: Workspace,
		project: Project,
		targetBranch?: string,
	): Promise<string>;
	getWorktreeInfo(
		workspaceId: string,
		projects: Project[],
	): Promise<WorktreeInfo[]>;
	pruneWorktrees(project: Project): Promise<void>;
}

export type { IAgentConfigRepository } from "../repositories/agent-config";
export type {
	ExecutorProcessInfo,
	ExecutorStartOptions,
	ExecutorStartProtocolOptions,
	IExecutorRepository,
} from "../repositories/executor/repository";
export type {
	IMessageQueueRepository,
	QueuedMessage,
	QueueStatus,
} from "../repositories/message-queue/repository";

// ============================================
// In-memory Store Repositories
// ============================================

export type { IApprovalRepository } from "../repositories/approval/repository";
export type { IDraftRepository } from "../repositories/draft/repository";

import type { IApprovalRepository } from "../repositories/approval/repository";

export interface IApprovalStore {
	createAndWait(
		approval: Approval,
		repo: IApprovalRepository,
	): Promise<{ status: Approval.Status; reason: string | null }>;
	respond(
		id: string,
		status: "approved" | "denied",
		reason: string | null,
		repo: IApprovalRepository,
	): Promise<boolean>;
	getRespondedStatus(
		approvalId: string,
		repo: IApprovalRepository,
	): Promise<{ status: Approval.Status; reason: string | null } | null>;
	hasPending(executionProcessId: string): boolean;
	listPending(executionProcessId: string): Approval[];
	clear(): void;
}

export interface IPermissionStoreRepository {
	add(permission: PendingPermission): void;
	get(requestId: string): PendingPermission | undefined;
	listByProcess(processId: string): PendingPermission[];
	listBySession(sessionId: string): PendingPermission[];
	remove(requestId: string): boolean;
	clear(): void;
}

export interface ILogStore {
	subscribe(): LogStoreSubscription;
}

export interface ILogStoreManager {
	get(processId: string): ILogStore | undefined;
	create(processId: string): ILogStore;
	close(processId: string): void;
}

export interface IDevServerRepository {
	start(options: {
		processId: string;
		command: string;
		workingDir: string;
	}): void;
	stop(processId: string): boolean;
	get(processId: string): { pid: number } | undefined;
}
