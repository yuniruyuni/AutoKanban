// Repository interfaces - no bun:sqlite dependency
// These interfaces define the contract for data access and external system calls

import type { Approval } from "../models/approval";
import type { BranchStatus, ConflictOp } from "../models/branch-status";
import type {
	CodingAgentResumeInfo,
	CodingAgentTurn,
} from "../models/coding-agent-turn";
import type {
	Cursor,
	Draft,
	LogStoreSubscription,
	Page,
	PendingPermission,
} from "../models/common";
import type {
	ExecutionProcess,
	ExecutionProcessLogs,
} from "../models/execution-process";
import type { GitDiff } from "../models/git-diff";
import type { Project, ProjectWithStats } from "../models/project";
import type { Session } from "../models/session";
import type { Task } from "../models/task";
import type { TaskTemplate } from "../models/task-template";
import type { Tool } from "../models/tool";
import type { Variant } from "../models/variant";
import type { Workspace } from "../models/workspace";
import type { WorkspaceRepo } from "../models/workspace-repo";
import type { WorktreeInfo } from "../models/worktree-info";

export interface ITaskRepository {
	get(spec: Task.Spec): Task | null;
	list(spec: Task.Spec, cursor: Cursor<Task.SortKey>): Page<Task>;
	upsert(task: Task): void;
	delete(spec: Task.Spec): number;
	count(spec: Task.Spec): number;
}

export interface ITaskTemplateRepository {
	get(spec: TaskTemplate.Spec): TaskTemplate | null;
	list(
		spec: TaskTemplate.Spec,
		cursor: Cursor<TaskTemplate.SortKey>,
	): Page<TaskTemplate>;
	listAll(): TaskTemplate[];
	upsert(template: TaskTemplate): void;
	delete(spec: TaskTemplate.Spec): number;
}

export interface IProjectRepository {
	get(spec: Project.Spec): Project | null;
	list(spec: Project.Spec, cursor: Cursor<Project.SortKey>): Page<Project>;
	listAll(): Project[];
	listAllWithStats(): ProjectWithStats[];
	getWithStats(projectId: string): ProjectWithStats | null;
	upsert(project: Project): void;
	delete(spec: Project.Spec): number;
}

export interface IWorkspaceRepository {
	get(spec: Workspace.Spec): Workspace | null;
	list(
		spec: Workspace.Spec,
		cursor: Cursor<Workspace.SortKey>,
	): Page<Workspace>;
	findByWorktreePath(worktreePath: string): Workspace | null;
	getMaxAttempt(taskId: string): number;
	upsert(workspace: Workspace): void;
	delete(spec: Workspace.Spec): number;
}

export interface IWorkspaceRepoRepository {
	get(spec: WorkspaceRepo.Spec): WorkspaceRepo | null;
	list(
		spec: WorkspaceRepo.Spec,
		cursor: Cursor<WorkspaceRepo.SortKey>,
	): Page<WorkspaceRepo>;
	listByWorkspace(workspaceId: string): WorkspaceRepo[];
	upsert(workspaceRepo: WorkspaceRepo): void;
	delete(spec: WorkspaceRepo.Spec): number;
}

export interface ISessionRepository {
	get(spec: Session.Spec): Session | null;
	list(spec: Session.Spec, cursor: Cursor<Session.SortKey>): Page<Session>;
	upsert(session: Session): void;
	delete(spec: Session.Spec): number;
}

export interface IExecutionProcessRepository {
	get(spec: ExecutionProcess.Spec): ExecutionProcess | null;
	list(
		spec: ExecutionProcess.Spec,
		cursor: Cursor<ExecutionProcess.SortKey>,
	): Page<ExecutionProcess>;
	upsert(process: ExecutionProcess): void;
	delete(spec: ExecutionProcess.Spec): number;
}

export interface IExecutionProcessLogsRepository {
	getLogs(executionProcessId: string): ExecutionProcessLogs | null;
	upsertLogs(logs: ExecutionProcessLogs): void;
	appendLogs(executionProcessId: string, newLogs: string): void;
	deleteLogs(executionProcessId: string): void;
}

export interface IToolRepository {
	get(spec: Tool.Spec): Tool | null;
	list(spec: Tool.Spec, cursor: Cursor<Tool.SortKey>): Page<Tool>;
	listAll(): Tool[];
	upsert(tool: Tool): void;
	delete(spec: Tool.Spec): number;
	/** Execute a shell command. Uses `sh -c` to support PATH-based commands. */
	executeCommand(command: string, cwd?: string): void;
}

export interface IVariantRepository {
	get(spec: Variant.Spec): Variant | null;
	list(spec: Variant.Spec, cursor: Cursor<Variant.SortKey>): Page<Variant>;
	listByExecutor(executor: string): Variant[];
	upsert(variant: Variant): void;
	delete(spec: Variant.Spec): number;
}

export interface ICodingAgentTurnRepository {
	get(spec: CodingAgentTurn.Spec): CodingAgentTurn | null;
	list(
		spec: CodingAgentTurn.Spec,
		cursor: Cursor<CodingAgentTurn.SortKey>,
	): Page<CodingAgentTurn>;
	upsert(turn: CodingAgentTurn): void;
	delete(spec: CodingAgentTurn.Spec): number;
	updateAgentSessionId(
		executionProcessId: string,
		agentSessionId: string,
	): void;
	updateAgentMessageId(
		executionProcessId: string,
		agentMessageId: string,
	): void;
	updateSummary(executionProcessId: string, summary: string): void;
	findLatestResumeInfo(sessionId: string): CodingAgentResumeInfo | null;
	findLatestResumeInfoByWorkspaceId(
		workspaceId: string,
	): CodingAgentResumeInfo | null;
}

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

export interface ExecutorStartOptions {
	sessionId: string;
	runReason: ExecutionProcess.RunReason;
	workingDir: string;
	prompt: string;
	dangerouslySkipPermissions?: boolean;
	model?: string;
	/** Which driver to use. Defaults to "claude-code". */
	executor?: string;
}

export interface ExecutorStartProtocolOptions {
	sessionId: string;
	runReason: ExecutionProcess.RunReason;
	workingDir: string;
	prompt: string;
	model?: string;
	permissionMode?: string;
	resumeSessionId?: string;
	resumeMessageId?: string;
	interruptedTools?: Array<{ toolId: string; toolName: string }>;
	/** Which driver to use. Defaults to "claude-code". */
	executor?: string;
}

export interface ExecutorProcessInfo {
	id: string;
	sessionId: string;
	runReason: ExecutionProcess.RunReason;
	startedAt: Date;
}

export interface IExecutorRepository {
	start(options: ExecutorStartOptions): Promise<ExecutorProcessInfo>;
	startProtocol(
		options: ExecutorStartProtocolOptions,
	): Promise<ExecutorProcessInfo>;
	stop(processId: string): Promise<boolean>;
	sendMessage(processId: string, prompt: string): Promise<boolean>;
	sendPermissionResponse(
		processId: string,
		requestId: string,
		approved: boolean,
		requestSubtype?: string,
		reason?: string,
	): Promise<boolean>;
	startProtocolAndWait(
		options: ExecutorStartProtocolOptions,
	): Promise<{ exitCode: number }>;
	get(processId: string): ExecutorProcessInfo | undefined;
	getBySession(sessionId: string): ExecutorProcessInfo[];
	getStdout(processId: string): ReadableStream<Uint8Array> | null;
	getStderr(processId: string): ReadableStream<Uint8Array> | null;
}

export interface QueuedMessage {
	sessionId: string;
	prompt: string;
	executor?: string;
	variant?: string;
	queuedAt: Date;
}

export interface QueueStatus {
	hasMessage: boolean;
	message?: QueuedMessage;
}

export interface IMessageQueueRepository {
	queue(
		sessionId: string,
		prompt: string,
		executor?: string,
		variant?: string,
	): QueuedMessage;
	get(sessionId: string): QueuedMessage | undefined;
	getStatus(sessionId: string): QueueStatus;
	consume(sessionId: string): QueuedMessage | undefined;
	cancel(sessionId: string): boolean;
	has(sessionId: string): boolean;
	clear(): void;
}

export type { IAgentConfigRepository } from "../repositories/agent-config-repository";

// ============================================
// In-memory Store Repositories
// ============================================

export interface IDraftRepository {
	save(sessionId: string, text: string): void;
	get(sessionId: string): Draft | undefined;
	delete(sessionId: string): boolean;
	clear(): void;
}

export interface IApprovalRepository {
	get(spec: Approval.Spec): Approval | null;
	list(spec: Approval.Spec, cursor: Cursor<Approval.SortKey>): Page<Approval>;
	upsert(approval: Approval): void;
	delete(spec: Approval.Spec): number;
}

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
	): boolean;
	getRespondedStatus(
		approvalId: string,
		repo: IApprovalRepository,
	): { status: Approval.Status; reason: string | null } | null;
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
