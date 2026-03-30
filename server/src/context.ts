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
import type { Context, DbRepoDefs, ExternalRepos } from "./types/context";
import {
	bindDbCtx,
	createDbWriteCtx,
	type DbWriteCtx,
} from "./types/db-capability";
import type { ILogger } from "./types/logger";

function createRawDbRepos(): DbRepoDefs {
	return {
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
	};
}

function bindAllDbRepos<Ctx extends DbWriteCtx>(raw: DbRepoDefs, ctx: Ctx) {
	return {
		task: bindDbCtx(raw.task, ctx),
		taskTemplate: bindDbCtx(raw.taskTemplate, ctx),
		project: bindDbCtx(raw.project, ctx),
		workspace: bindDbCtx(raw.workspace, ctx),
		workspaceRepo: bindDbCtx(raw.workspaceRepo, ctx),
		session: bindDbCtx(raw.session, ctx),
		executionProcess: bindDbCtx(raw.executionProcess, ctx),
		executionProcessLogs: bindDbCtx(raw.executionProcessLogs, ctx),
		codingAgentTurn: bindDbCtx(raw.codingAgentTurn, ctx),
		tool: bindDbCtx(raw.tool, ctx),
		variant: bindDbCtx(raw.variant, ctx),
		approval: bindDbCtx(raw.approval, ctx),
	};
}

export function createContext(db: PgDatabase, logger: ILogger): Context {
	const rawDbRepos = createRawDbRepos();

	// Bind DB repos with pool-level db for presentation layer / orchestrator
	const poolCtx = createDbWriteCtx(db);
	const boundDbRepos = bindAllDbRepos(rawDbRepos, poolCtx);

	const gitRepo = new GitRepository();
	const worktreeRepo = new WorktreeRepository(logger);
	const drivers = new Map();
	drivers.set("claude-code", new ClaudeCodeDriver(logger));
	drivers.set("gemini-cli", new GeminiCliDriver(logger));
	const executor = new ExecutorRepository(
		boundDbRepos.executionProcess,
		boundDbRepos.codingAgentTurn,
		drivers,
		boundDbRepos.executionProcessLogs,
		logger,
	);

	// Wire up approval dependencies for ExitPlanMode handling
	executor.setApprovalDeps({
		approvalRepo: boundDbRepos.approval,
		approvalStore: approvalStore,
		taskRepo: boundDbRepos.task,
		sessionRepo: boundDbRepos.session,
		workspaceRepo: boundDbRepos.workspace,
	});

	const logStreamer = new LogStreamer(executor, logStoreManager, logger);
	const agentConfig = new AgentConfigRepository();
	const workspaceConfigRepo = new WorkspaceConfigRepository();
	const devServer = new DevServerRepository(
		boundDbRepos.executionProcessLogs,
		logger,
	);

	const externalRepos: ExternalRepos = {
		git: gitRepo,
		worktree: worktreeRepo,
		executor,
		messageQueue: messageQueueRepository,
		agentConfig,
		workspaceConfig: workspaceConfigRepo,
		draft: draftRepository,
		permissionStore,
		approvalStore,
		logStoreManager,
		devServer,
	};

	// Set up queue processor
	setupQueueProcessor({
		executor,
		messageQueue: messageQueueRepository,
		sessionRepo: boundDbRepos.session,
		workspaceRepo: boundDbRepos.workspace,
		workspaceRepoRepo: boundDbRepos.workspaceRepo,
		projectRepo: boundDbRepos.project,
		taskRepo: boundDbRepos.task,
		logger,
	});

	return {
		now: new Date(),
		logger,
		db,
		rawDbRepos,
		externalRepos,
		repos: { ...boundDbRepos, ...externalRepos },
		logStreamer,
	};
}
