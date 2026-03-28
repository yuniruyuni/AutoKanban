import type { Database } from "bun:sqlite";
import { LogStreamer } from "./presentation/log-streamer";
import { AgentConfigRepository } from "./repositories/agent-config-repository";
import { ApprovalRepository } from "./repositories/approval-repository";
import { approvalStore } from "./repositories/approval-store";
import { ClaudeCodeExecutor } from "./repositories/claude-code-executor";
import { CodingAgentTurnRepository } from "./repositories/coding-agent-turn-repository";
import { draftRepository } from "./repositories/draft-repository";
import { ExecutionProcessLogsRepository } from "./repositories/execution-process-logs-repository";
import { ExecutionProcessRepository } from "./repositories/execution-process-repository";
import { ExecutorRepository } from "./repositories/executor-repository";
import { GitRepository } from "./repositories/git-repository";
import { logStoreManager } from "./repositories/log-store";
import { messageQueueRepository } from "./repositories/message-queue-repository";
import { permissionStore } from "./repositories/permission-store";
import { ProjectRepository } from "./repositories/project-repository";
import { SessionRepository } from "./repositories/session-repository";
import { TaskRepository } from "./repositories/task-repository";
import { TaskTemplateRepository } from "./repositories/task-template-repository";
import { ToolRepository } from "./repositories/tool-repository";
import { VariantRepository } from "./repositories/variant-repository";
import { WorkspaceRepoRepository } from "./repositories/workspace-repo-repository";
import { WorkspaceRepository } from "./repositories/workspace-repository";
import { DevServerRepository } from "./repositories/dev-server-repository";
import { WorktreeRepository } from "./repositories/worktree-repository";
import { setupQueueProcessor } from "./setup/queue-processor";
import type { Context } from "./types/context";
import type { ILogger } from "./types/logger";

export function createContext(db: Database, logger: ILogger): Context {
	const executionProcessRepo = new ExecutionProcessRepository(db);
	const codingAgentTurnRepo = new CodingAgentTurnRepository(db);
	const sessionRepo = new SessionRepository(db);
	const workspaceRepo = new WorkspaceRepository(db);
	const workspaceRepoRepo = new WorkspaceRepoRepository(db);
	const projectRepo = new ProjectRepository(db);

	const taskRepo = new TaskRepository(db);
	const taskTemplateRepo = new TaskTemplateRepository(db);
	const gitRepo = new GitRepository();
	const worktreeRepo = new WorktreeRepository(logger);
	const executionProcessLogsRepo = new ExecutionProcessLogsRepository(db);
	const executor = new ExecutorRepository(
		executionProcessRepo,
		codingAgentTurnRepo,
		new ClaudeCodeExecutor(),
		executionProcessLogsRepo,
		logger,
	);
	const approvalRepo = new ApprovalRepository(db);

	// Wire up approval dependencies for ExitPlanMode handling
	executor.setApprovalDeps({
		approvalRepo: approvalRepo,
		approvalStore: approvalStore,
		taskRepo,
		sessionRepo,
		workspaceRepo,
	});

	const logStreamer = new LogStreamer(executor, logStoreManager, logger);
	const agentConfig = new AgentConfigRepository();
	const devServer = new DevServerRepository(executionProcessLogsRepo, logger);

	// Set up queue processor to auto-consume queued messages on process completion
	// and handle automatic task status transitions
	setupQueueProcessor({
		executor,
		messageQueue: messageQueueRepository,
		sessionRepo,
		workspaceRepo,
		workspaceRepoRepo,
		projectRepo,
		taskRepo,
		logger,
	});

	return {
		now: new Date(),
		logger,
		repos: {
			task: taskRepo,
			taskTemplate: taskTemplateRepo,
			project: projectRepo,
			workspace: workspaceRepo,
			workspaceRepo: workspaceRepoRepo,
			session: sessionRepo,
			executionProcess: executionProcessRepo,
			executionProcessLogs: executionProcessLogsRepo,
			codingAgentTurn: codingAgentTurnRepo,
			tool: new ToolRepository(db),
			variant: new VariantRepository(db),
			git: gitRepo,
			worktree: worktreeRepo,
			executor,
			messageQueue: messageQueueRepository,
			agentConfig,
			draft: draftRepository,
			permissionStore,
			approval: approvalRepo,
			approvalStore,
			logStoreManager,
			devServer,
		},
		logStreamer,
	};
}
