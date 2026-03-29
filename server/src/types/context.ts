// Context types define the context available to usecases and procedures

import type { ILogStreamer } from "../presentation/log-streamer";
import type { ILogger } from "./logger";
import type {
	IAgentConfigRepository,
	IApprovalRepository,
	IApprovalStore,
	ICodingAgentTurnRepository,
	IDevServerRepository,
	IDraftRepository,
	IExecutionProcessLogsRepository,
	IExecutionProcessRepository,
	IExecutorRepository,
	IGitRepository,
	ILogStoreManager,
	IMessageQueueRepository,
	IPermissionStoreRepository,
	IProjectRepository,
	ISessionRepository,
	ITaskRepository,
	ITaskTemplateRepository,
	IToolRepository,
	IVariantRepository,
	IWorkspaceRepoRepository,
	IWorkspaceRepository,
	IWorktreeRepository,
} from "./repository";

export interface Repos {
	// DB Repositories
	task: ITaskRepository;
	taskTemplate: ITaskTemplateRepository;
	project: IProjectRepository;
	workspace: IWorkspaceRepository;
	workspaceRepo: IWorkspaceRepoRepository;
	session: ISessionRepository;
	executionProcess: IExecutionProcessRepository;
	executionProcessLogs: IExecutionProcessLogsRepository;
	codingAgentTurn: ICodingAgentTurnRepository;
	tool: IToolRepository;
	variant: IVariantRepository;
	// External System Repositories
	git: IGitRepository;
	worktree: IWorktreeRepository;
	executor: IExecutorRepository;
	messageQueue: IMessageQueueRepository;
	agentConfig: IAgentConfigRepository;
	// In-memory Store Repositories
	draft: IDraftRepository;
	permissionStore: IPermissionStoreRepository;
	approval: IApprovalRepository;
	approvalStore: IApprovalStore;
	logStoreManager: ILogStoreManager;
	devServer: IDevServerRepository;
}

// Step-specific context types
export type PreContext = { now: Date; logger: ILogger };
export type ReadContext = { now: Date; logger: ILogger; repos: Repos };
export type ProcessContext = { now: Date; logger: ILogger };
export type WriteContext = { now: Date; logger: ILogger; repos: Repos };
export type PostContext = { now: Date; logger: ILogger; repos: Repos };

// Full context (used by .run() and presentation layer)
export interface Context {
	now: Date;
	logger: ILogger;
	repos: Repos;
	// Presentation-layer services (kept in Context for router access)
	logStreamer: ILogStreamer;
}
