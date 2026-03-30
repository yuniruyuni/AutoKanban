// ============================================
// DB Repository re-exports
// ============================================

export type { ApprovalRepository } from "./approval/repository";
export type { CodingAgentTurnRepository } from "./coding-agent-turn/repository";
export type { ExecutionProcessRepository } from "./execution-process/repository";
export type { ExecutionProcessLogsRepository } from "./execution-process-logs/repository";
export type { ProjectRepository } from "./project/repository";
export type { SessionRepository } from "./session/repository";
export type { TaskRepository } from "./task/repository";
export type { TaskTemplateRepository } from "./task-template/repository";
export type { ToolRepository } from "./tool/repository";
export type { VariantRepository } from "./variant/repository";
export type { WorkspaceRepository } from "./workspace/repository";
export type { WorkspaceRepoRepository } from "./workspace-repo/repository";

// ============================================
// External System Repository re-exports
// ============================================

export type {
	AgentAdapter,
	AgentConfigRepository,
} from "./agent-config/repository";
export type { ApprovalStoreRepository } from "./approval-store/repository";
export type { DevServerRepository } from "./dev-server/repository";
export type { DraftRepository } from "./draft/repository";
export type {
	ExecutorProcessInfo,
	ExecutorRepository,
	ExecutorStartOptions,
	ExecutorStartProtocolOptions,
} from "./executor/repository";
export type { GitRepository } from "./git/repository";
export type { LogStore, LogStoreManager } from "./log-store/repository";
export type {
	MessageQueueRepository,
	QueuedMessage,
	QueueStatus,
} from "./message-queue/repository";
export type { PermissionStoreRepository } from "./permission-store/repository";
export type { WorkspaceConfigRepository } from "./workspace-config/repository";
export type { WorktreeRepository } from "./worktree/repository";

// ============================================
// Common re-exports
// ============================================

export * from "./common";

// ============================================
// Repos aggregate type
// ============================================

import type { AgentConfigRepository } from "./agent-config/repository";
import type { ApprovalRepository } from "./approval/repository";
import type { ApprovalStoreRepository } from "./approval-store/repository";
import type { CodingAgentTurnRepository } from "./coding-agent-turn/repository";
import type { DevServerRepository } from "./dev-server/repository";
import type { DraftRepository } from "./draft/repository";
import type { ExecutionProcessRepository } from "./execution-process/repository";
import type { ExecutionProcessLogsRepository } from "./execution-process-logs/repository";
import type { ExecutorRepository } from "./executor/repository";
import type { GitRepository } from "./git/repository";
import type { LogStoreManager } from "./log-store/repository";
import type { MessageQueueRepository } from "./message-queue/repository";
import type { PermissionStoreRepository } from "./permission-store/repository";
import type { ProjectRepository } from "./project/repository";
import type { SessionRepository } from "./session/repository";
import type { TaskRepository } from "./task/repository";
import type { TaskTemplateRepository } from "./task-template/repository";
import type { ToolRepository } from "./tool/repository";
import type { VariantRepository } from "./variant/repository";
import type { WorkspaceRepository } from "./workspace/repository";
import type { WorkspaceConfigRepository } from "./workspace-config/repository";
import type { WorkspaceRepoRepository } from "./workspace-repo/repository";
import type { WorktreeRepository } from "./worktree/repository";

// ============================================
// Repos binding
// ============================================

import { bindCtx, type ExtractMethods } from "./common";

type ExtractRepos<Ctx> = { [K in keyof Repos]: ExtractMethods<Repos[K], Ctx> };

/**
 * Bind all repos with a context, producing a view where each repo's methods
 * matching the Ctx marker have that first argument pre-filled.
 */
export function bindRepos<Ctx>(raw: Repos, ctx: Ctx): ExtractRepos<Ctx> {
	return Object.fromEntries(
		Object.entries(raw).map(([key, repo]) => [key, bindCtx(repo, ctx)]),
	) as ExtractRepos<Ctx>;
}

// ============================================
// Repos aggregate type
// ============================================

export interface Repos {
	// DB repositories
	task: TaskRepository;
	taskTemplate: TaskTemplateRepository;
	project: ProjectRepository;
	workspace: WorkspaceRepository;
	workspaceRepo: WorkspaceRepoRepository;
	session: SessionRepository;
	executionProcess: ExecutionProcessRepository;
	executionProcessLogs: ExecutionProcessLogsRepository;
	codingAgentTurn: CodingAgentTurnRepository;
	tool: ToolRepository;
	variant: VariantRepository;
	approval: ApprovalRepository;

	// External repositories
	git: GitRepository;
	worktree: WorktreeRepository;
	executor: ExecutorRepository;
	messageQueue: MessageQueueRepository;
	agentConfig: AgentConfigRepository;
	workspaceConfig: WorkspaceConfigRepository;
	draft: DraftRepository;
	permissionStore: PermissionStoreRepository;
	approvalStore: ApprovalStoreRepository;
	logStoreManager: LogStoreManager;
	devServer: DevServerRepository;
}
