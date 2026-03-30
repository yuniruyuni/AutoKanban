// Context types define the context available to usecases and procedures

import type { PgDatabase } from "../db/pg-client";
import type { ILogStreamer } from "../presentation/log-streamer";
import type { ReadMethods, StripMarkers } from "./db-capability";
import type { ILogger } from "./logger";
import type {
	IAgentConfigRepository,
	IApprovalRepositoryDef,
	IApprovalStore,
	ICodingAgentTurnRepositoryDef,
	IDevServerRepository,
	IDraftRepository,
	IExecutionProcessLogsRepositoryDef,
	IExecutionProcessRepositoryDef,
	IExecutorRepository,
	IGitRepository,
	ILogStoreManager,
	IMessageQueueRepository,
	IPermissionStoreRepository,
	IProjectRepositoryDef,
	ISessionRepositoryDef,
	ITaskRepositoryDef,
	ITaskTemplateRepositoryDef,
	IToolRepositoryDef,
	IVariantRepositoryDef,
	IWorkspaceConfigRepository,
	IWorkspaceRepoRepositoryDef,
	IWorkspaceRepositoryDef,
	IWorktreeRepository,
} from "./repository";

// ============================================
// DB Repository Definitions (with DbCtx markers)
// ============================================

export interface DbRepoDefs {
	task: ITaskRepositoryDef;
	taskTemplate: ITaskTemplateRepositoryDef;
	project: IProjectRepositoryDef;
	workspace: IWorkspaceRepositoryDef;
	workspaceRepo: IWorkspaceRepoRepositoryDef;
	session: ISessionRepositoryDef;
	executionProcess: IExecutionProcessRepositoryDef;
	executionProcessLogs: IExecutionProcessLogsRepositoryDef;
	codingAgentTurn: ICodingAgentTurnRepositoryDef;
	tool: IToolRepositoryDef;
	variant: IVariantRepositoryDef;
	approval: IApprovalRepositoryDef;
}

// ============================================
// External Repositories (no DbCtx markers)
// ============================================

export interface ExternalRepos {
	git: IGitRepository;
	worktree: IWorktreeRepository;
	executor: IExecutorRepository;
	messageQueue: IMessageQueueRepository;
	agentConfig: IAgentConfigRepository;
	workspaceConfig: IWorkspaceConfigRepository;
	draft: IDraftRepository;
	permissionStore: IPermissionStoreRepository;
	approvalStore: IApprovalStore;
	logStoreManager: ILogStoreManager;
	devServer: IDevServerRepository;
}

// ============================================
// Repos views (derived from DbRepoDefs)
// ============================================

/** DB read-only: get, list, count, find* */
type DbReadRepos = { [K in keyof DbRepoDefs]: ReadMethods<DbRepoDefs[K]> };

/** DB full access: read + write (markers stripped) */
type DbFullRepos = { [K in keyof DbRepoDefs]: StripMarkers<DbRepoDefs[K]> };

/** ReadContext repos: DB read only (no External — avoids blocking transaction) */
export type ReadRepos = DbReadRepos;

/** WriteContext repos: DB read + write (no External — avoids blocking transaction) */
export type WriteRepos = DbFullRepos;

/** PostContext repos: DB full + External (outside transaction) */
export type PostRepos = DbFullRepos & ExternalRepos;

/** Full repos (used by Context for presentation layer) */
export type Repos = DbFullRepos & ExternalRepos;

// ============================================
// Step-specific context types
// ============================================

export type PreContext = { now: Date; logger: ILogger };
export type ReadContext = { now: Date; logger: ILogger; repos: ReadRepos };
export type ProcessContext = { now: Date; logger: ILogger };
export type WriteContext = { now: Date; logger: ILogger; repos: WriteRepos };
export type PostContext = { now: Date; logger: ILogger; repos: PostRepos };

// ============================================
// Full context
// ============================================

export interface Context {
	now: Date;
	logger: ILogger;
	db: PgDatabase;
	rawDbRepos: DbRepoDefs;
	externalRepos: ExternalRepos;
	repos: Repos;
	logStreamer: ILogStreamer;
}
