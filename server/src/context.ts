import type { PgDatabase } from "./db/pg-client";
import { LogStreamer } from "./presentation/log-streamer";
import { AgentConfigRepository } from "./repositories/agent-config";
import { ApprovalRepository } from "./repositories/approval";
import { approvalStore } from "./repositories/approval-store";
import { CodingAgentTurnRepository } from "./repositories/coding-agent-turn";
import { DevServerRepository } from "./repositories/dev-server";
import { draftRepository } from "./repositories/draft";
import { ExecutionProcessRepository } from "./repositories/execution-process";
import { ExecutionProcessLogsRepository } from "./repositories/execution-process-logs";
import { ExecutorRepository } from "./repositories/executor";
import { ClaudeCodeDriver } from "./repositories/executor/drivers/claude-code";
import { GeminiCliDriver } from "./repositories/executor/drivers/gemini-cli";
import { GitRepository } from "./repositories/git";
import { logStoreManager } from "./repositories/log-store";
import { messageQueueRepository } from "./repositories/message-queue";
import { permissionStore } from "./repositories/permission-store";
import { ProjectRepository } from "./repositories/project";
import { SessionRepository } from "./repositories/session";
import { TaskRepository } from "./repositories/task";
import { TaskTemplateRepository } from "./repositories/task-template";
import { ToolRepository } from "./repositories/tool";
import { VariantRepository } from "./repositories/variant";
import { WorkspaceRepository } from "./repositories/workspace";
import { WorkspaceConfigRepository } from "./repositories/workspace-config";
import { WorkspaceRepoRepository } from "./repositories/workspace-repo";
import { WorktreeRepository } from "./repositories/worktree";
import { setupQueueProcessor } from "./setup/queue-processor";
import type { Context } from "./types/context";
import type { ILogger } from "./types/logger";

export function createContext(db: PgDatabase, logger: ILogger): Context {
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
	const drivers = new Map();
	drivers.set("claude-code", new ClaudeCodeDriver(logger));
	drivers.set("gemini-cli", new GeminiCliDriver(logger));
	const executor = new ExecutorRepository(
		executionProcessRepo,
		codingAgentTurnRepo,
		drivers,
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
	const workspaceConfigRepo = new WorkspaceConfigRepository();
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
		db,
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
			workspaceConfig: workspaceConfigRepo,
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
