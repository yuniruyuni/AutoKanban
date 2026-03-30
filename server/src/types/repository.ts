// Repository interfaces define the contract for data access and external system calls

// ============================================
// DB Repository re-exports
// ============================================

export type { ApprovalRepository } from "../repositories/approval/repository";
export type { CodingAgentTurnRepository } from "../repositories/coding-agent-turn/repository";
export type { ExecutionProcessRepository } from "../repositories/execution-process/repository";
export type { ExecutionProcessLogsRepository } from "../repositories/execution-process-logs/repository";
export type { ProjectRepository } from "../repositories/project/repository";
export type { SessionRepository } from "../repositories/session/repository";
export type { TaskRepository } from "../repositories/task/repository";
export type { TaskTemplateRepository } from "../repositories/task-template/repository";
export type { ToolRepository } from "../repositories/tool/repository";
export type { VariantRepository } from "../repositories/variant/repository";
export type { WorkspaceRepository } from "../repositories/workspace/repository";
export type { WorkspaceRepoRepository } from "../repositories/workspace-repo/repository";

// ============================================
// External System Repository re-exports
// ============================================

export type {
	AgentAdapter,
	AgentConfigRepository,
} from "../repositories/agent-config/repository";
export type { ApprovalStoreRepository } from "../repositories/approval-store/repository";
export type { DevServerRepository } from "../repositories/dev-server/repository";
export type { DraftRepository } from "../repositories/draft/repository";
export type {
	ExecutorProcessInfo,
	ExecutorRepository,
	ExecutorStartOptions,
	ExecutorStartProtocolOptions,
} from "../repositories/executor/repository";
export type { GitRepository } from "../repositories/git/repository";
export type {
	LogStore,
	LogStoreManager,
} from "../repositories/log-store/repository";
export type {
	MessageQueueRepository,
	QueuedMessage,
	QueueStatus,
} from "../repositories/message-queue/repository";
export type { PermissionStoreRepository } from "../repositories/permission-store/repository";
export type { WorkspaceConfigRepository } from "../repositories/workspace-config/repository";
export type { WorktreeRepository } from "../repositories/worktree/repository";

// ============================================
// Repos aggregate type
// ============================================

import type { AgentConfigRepository } from "../repositories/agent-config/repository";
import type { ApprovalRepository } from "../repositories/approval/repository";
import type { ApprovalStoreRepository } from "../repositories/approval-store/repository";
import type { CodingAgentTurnRepository } from "../repositories/coding-agent-turn/repository";
import type { DevServerRepository } from "../repositories/dev-server/repository";
import type { DraftRepository } from "../repositories/draft/repository";
import type { ExecutionProcessRepository } from "../repositories/execution-process/repository";
import type { ExecutionProcessLogsRepository } from "../repositories/execution-process-logs/repository";
import type { ExecutorRepository } from "../repositories/executor/repository";
import type { GitRepository } from "../repositories/git/repository";
import type { LogStoreManager } from "../repositories/log-store/repository";
import type { MessageQueueRepository } from "../repositories/message-queue/repository";
import type { PermissionStoreRepository } from "../repositories/permission-store/repository";
import type { ProjectRepository } from "../repositories/project/repository";
import type { SessionRepository } from "../repositories/session/repository";
import type { TaskRepository } from "../repositories/task/repository";
import type { TaskTemplateRepository } from "../repositories/task-template/repository";
import type { ToolRepository } from "../repositories/tool/repository";
import type { VariantRepository } from "../repositories/variant/repository";
import type { WorkspaceRepository } from "../repositories/workspace/repository";
import type { WorkspaceConfigRepository } from "../repositories/workspace-config/repository";
import type { WorkspaceRepoRepository } from "../repositories/workspace-repo/repository";
import type { WorktreeRepository } from "../repositories/worktree/repository";

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
