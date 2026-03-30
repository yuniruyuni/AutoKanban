import type { PgDatabase } from "./db/pg-client";
import { LogStreamer } from "./presentation/log-streamer";
import { AgentConfigRepository } from "./repositories/agent-config";
import { ApprovalRepository } from "./repositories/approval/postgres";
import { approvalStore } from "./repositories/approval-store";
import { CodingAgentTurnRepository } from "./repositories/coding-agent-turn/postgres";
import { DevServerRepository } from "./repositories/dev-server";
import { draftRepository } from "./repositories/draft";
import { ExecutionProcessRepository } from "./repositories/execution-process/postgres";
import { ExecutionProcessLogsRepository } from "./repositories/execution-process-logs/postgres";
import { ExecutorRepository } from "./repositories/executor";
import { ClaudeCodeDriver } from "./repositories/executor/drivers/claude-code";
import { GeminiCliDriver } from "./repositories/executor/drivers/gemini-cli";
import { GitRepository } from "./repositories/git";
import { logStoreManager } from "./repositories/log-store";
import { messageQueueRepository } from "./repositories/message-queue";
import { permissionStore } from "./repositories/permission-store";
import { ProjectRepository } from "./repositories/project/postgres";
import { SessionRepository } from "./repositories/session/postgres";
import { TaskRepository } from "./repositories/task/postgres";
import { TaskTemplateRepository } from "./repositories/task-template/postgres";
import { ToolRepository } from "./repositories/tool/postgres";
import { VariantRepository } from "./repositories/variant/postgres";
import { WorkspaceRepository } from "./repositories/workspace/postgres";
import { WorkspaceConfigRepository } from "./repositories/workspace-config";
import { WorkspaceRepoRepository } from "./repositories/workspace-repo/postgres";
import { WorktreeRepository } from "./repositories/worktree";
import { setupQueueProcessor } from "./setup/queue-processor";
import type { Context } from "./types/context";
import {
	bindCtx,
	createFullCtx,
	type DbWriteCtx,
	type FullRepos,
	type ServiceCtx,
} from "./types/db-capability";
import type { ILogger } from "./types/logger";
import type { Repos } from "./types/repository";

function createRawRepos(logger: ILogger): Repos {
	return {
		// DB repositories
		task: new TaskRepository(),
		taskTemplate: new TaskTemplateRepository(),
		project: new ProjectRepository(),
		workspace: new WorkspaceRepository(),
		workspaceRepo: new WorkspaceRepoRepository(),
		session: new SessionRepository(),
		executionProcess: new ExecutionProcessRepository(),
		executionProcessLogs: new ExecutionProcessLogsRepository(),
		codingAgentTurn: new CodingAgentTurnRepository(),
		tool: new ToolRepository(),
		variant: new VariantRepository(),
		approval: new ApprovalRepository(),
		// External repositories (placeholders, set after binding)
		git: new GitRepository(),
		worktree: new WorktreeRepository(logger),
		executor: undefined as unknown as Repos["executor"],
		messageQueue: messageQueueRepository,
		agentConfig: new AgentConfigRepository(),
		workspaceConfig: new WorkspaceConfigRepository(),
		draft: draftRepository,
		permissionStore,
		approvalStore,
		logStoreManager,
		devServer: undefined as unknown as Repos["devServer"],
	};
}

function bindAllRepos(
	raw: Repos,
	ctx: DbWriteCtx & ServiceCtx,
): FullRepos<Repos> {
	return {
		task: bindCtx(raw.task, ctx),
		taskTemplate: bindCtx(raw.taskTemplate, ctx),
		project: bindCtx(raw.project, ctx),
		workspace: bindCtx(raw.workspace, ctx),
		workspaceRepo: bindCtx(raw.workspaceRepo, ctx),
		session: bindCtx(raw.session, ctx),
		executionProcess: bindCtx(raw.executionProcess, ctx),
		executionProcessLogs: bindCtx(raw.executionProcessLogs, ctx),
		codingAgentTurn: bindCtx(raw.codingAgentTurn, ctx),
		tool: bindCtx(raw.tool, ctx),
		variant: bindCtx(raw.variant, ctx),
		approval: bindCtx(raw.approval, ctx),
		// External repos also get ctx binding now (ServiceCtx)
		git: bindCtx(raw.git, ctx),
		worktree: bindCtx(raw.worktree, ctx),
		executor: bindCtx(raw.executor, ctx),
		messageQueue: bindCtx(raw.messageQueue, ctx),
		agentConfig: bindCtx(raw.agentConfig, ctx),
		workspaceConfig: bindCtx(raw.workspaceConfig, ctx),
		draft: bindCtx(raw.draft, ctx),
		permissionStore: bindCtx(raw.permissionStore, ctx),
		approvalStore: bindCtx(raw.approvalStore, ctx),
		logStoreManager: bindCtx(raw.logStoreManager, ctx),
		devServer: bindCtx(raw.devServer, ctx),
	};
}

export function createContext(db: PgDatabase, logger: ILogger): Context {
	const rawRepos = createRawRepos(logger);

	// Bind repos with pool-level db + service ctx for presentation layer / orchestrator
	const fullCtx = createFullCtx(db);
	const boundRepos = bindAllRepos(rawRepos, fullCtx);

	const drivers = new Map();
	drivers.set("claude-code", new ClaudeCodeDriver(logger));
	drivers.set("gemini-cli", new GeminiCliDriver(logger));
	const executor = new ExecutorRepository(
		boundRepos.executionProcess,
		boundRepos.codingAgentTurn,
		drivers,
		boundRepos.executionProcessLogs,
		logger,
	);

	// Wire up approval dependencies for ExitPlanMode handling
	executor.setApprovalDeps({
		approvalRepo: boundRepos.approval,
		approvalStore: boundRepos.approvalStore,
		taskRepo: boundRepos.task,
		sessionRepo: boundRepos.session,
		workspaceRepo: boundRepos.workspace,
	});

	// Set executor and devServer on rawRepos
	rawRepos.executor = executor;
	rawRepos.devServer = new DevServerRepository(
		boundRepos.executionProcessLogs,
		logger,
	);

	const logStreamer = new LogStreamer(executor, logStoreManager, logger);

	// Set up queue processor
	setupQueueProcessor({
		executor,
		messageQueue: messageQueueRepository,
		sessionRepo: boundRepos.session,
		workspaceRepo: boundRepos.workspace,
		workspaceRepoRepo: boundRepos.workspaceRepo,
		projectRepo: boundRepos.project,
		taskRepo: boundRepos.task,
		logger,
	});

	// Re-bind after setting executor and devServer
	const finalRepos = bindAllRepos(rawRepos, fullCtx);

	return {
		now: new Date(),
		logger,
		db,
		rawRepos,
		repos: finalRepos,
		logStreamer,
	};
}
