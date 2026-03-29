import type { PgDatabase } from "./db/pg-client";
import { LogStreamer } from "./presentation/log-streamer";
import { AgentConfigRepository } from "./repositories/agent-config";
import { PgApprovalRepository } from "./repositories/approval";
import { approvalStore } from "./repositories/approval-store";
import { PgCodingAgentTurnRepository } from "./repositories/coding-agent-turn";
import { DevServerRepository } from "./repositories/dev-server";
import { draftRepository } from "./repositories/draft";
import { PgExecutionProcessRepository } from "./repositories/execution-process";
import { PgExecutionProcessLogsRepository } from "./repositories/execution-process-logs";
import { ExecutorRepository } from "./repositories/executor";
import { ClaudeCodeDriver } from "./repositories/executor/drivers/claude-code";
import { GeminiCliDriver } from "./repositories/executor/drivers/gemini-cli";
import { GitRepository } from "./repositories/git";
import { logStoreManager } from "./repositories/log-store";
import { messageQueueRepository } from "./repositories/message-queue";
import { permissionStore } from "./repositories/permission-store";
import { PgProjectRepository } from "./repositories/project";
import { PgSessionRepository } from "./repositories/session";
import { PgTaskRepository } from "./repositories/task";
import { PgTaskTemplateRepository } from "./repositories/task-template";
import { PgToolRepository } from "./repositories/tool";
import { PgVariantRepository } from "./repositories/variant";
import { PgWorkspaceRepository } from "./repositories/workspace";
import { PgWorkspaceRepoRepository } from "./repositories/workspace-repo";
import { WorktreeRepository } from "./repositories/worktree";
import { setupQueueProcessor } from "./setup/queue-processor";
import type { Context } from "./types/context";
import type { ILogger } from "./types/logger";

export function createContext(db: PgDatabase, logger: ILogger): Context {
	const executionProcessRepo = new PgExecutionProcessRepository(db);
	const codingAgentTurnRepo = new PgCodingAgentTurnRepository(db);
	const sessionRepo = new PgSessionRepository(db);
	const workspaceRepo = new PgWorkspaceRepository(db);
	const workspaceRepoRepo = new PgWorkspaceRepoRepository(db);
	const projectRepo = new PgProjectRepository(db);

	const taskRepo = new PgTaskRepository(db);
	const taskTemplateRepo = new PgTaskTemplateRepository(db);
	const gitRepo = new GitRepository();
	const worktreeRepo = new WorktreeRepository(logger);
	const executionProcessLogsRepo = new PgExecutionProcessLogsRepository(db);
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
	const approvalRepo = new PgApprovalRepository(db);

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
			tool: new PgToolRepository(db),
			variant: new PgVariantRepository(db),
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
