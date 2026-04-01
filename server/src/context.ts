import type { PgDatabase } from "./infra/db/pg-client";
import type { ILogger } from "./infra/logger/types";
import { CallbackClientImpl } from "./presentation/callback/impl";
import { bindCtx, bindRepos, type Repos } from "./repositories";
import { AgentConfigRepository } from "./repositories/agent-config";
import { ApprovalRepository } from "./repositories/approval/postgres";
import { approvalStore } from "./repositories/approval-store";
import { CodingAgentProcessRepository } from "./repositories/coding-agent-process/postgres";
import { CodingAgentProcessLogsRepository } from "./repositories/coding-agent-process-logs/postgres";
import { CodingAgentTurnRepository } from "./repositories/coding-agent-turn/postgres";
import { createFullCtx } from "./repositories/common";
import { DevServerRepository } from "./repositories/dev-server";
import { DevServerProcessRepository } from "./repositories/dev-server-process/postgres";
import { DevServerProcessLogsRepository } from "./repositories/dev-server-process-logs/postgres";
import { draftRepository } from "./repositories/draft";
import { draftPullRequestRepository } from "./repositories/draft-pull-request";
import { ExecutorRepository } from "./repositories/executor";
import { ClaudeCodeDriver } from "./repositories/executor/drivers/claude-code";
import { GeminiCliDriver } from "./repositories/executor/drivers/gemini-cli";
import { GitRepository } from "./repositories/git";
import { LogCollector } from "./repositories/log-collector";
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
import { WorkspaceScriptProcessRepository } from "./repositories/workspace-script-process/postgres";
import { WorkspaceScriptProcessLogsRepository } from "./repositories/workspace-script-process-logs/postgres";
import { WorktreeRepository } from "./repositories/worktree";
import type { Context } from "./usecases/context";

export function createContext(db: PgDatabase, logger: ILogger): Context {
	// Create callback client (initialized after repos are bound)
	const callbackClient = new CallbackClientImpl();

	// Create drivers
	const drivers = new Map();
	drivers.set("claude-code", new ClaudeCodeDriver(logger));
	drivers.set("gemini-cli", new GeminiCliDriver(logger));

	// 1. Construct all raw repos
	const rawRepos: Repos = {
		task: new TaskRepository(),
		taskTemplate: new TaskTemplateRepository(),
		project: new ProjectRepository(),
		workspace: new WorkspaceRepository(),
		workspaceRepo: new WorkspaceRepoRepository(),
		session: new SessionRepository(),
		codingAgentProcess: new CodingAgentProcessRepository(),
		codingAgentProcessLogs: new CodingAgentProcessLogsRepository(),
		devServerProcess: new DevServerProcessRepository(),
		devServerProcessLogs: new DevServerProcessLogsRepository(),
		workspaceScriptProcess: new WorkspaceScriptProcessRepository(),
		workspaceScriptProcessLogs: new WorkspaceScriptProcessLogsRepository(),
		codingAgentTurn: new CodingAgentTurnRepository(),
		tool: new ToolRepository(),
		variant: new VariantRepository(),
		approval: new ApprovalRepository(),
		git: new GitRepository(),
		worktree: new WorktreeRepository(logger),
		executor: new ExecutorRepository(drivers, logger, callbackClient),
		messageQueue: messageQueueRepository,
		agentConfig: new AgentConfigRepository(),
		workspaceConfig: new WorkspaceConfigRepository(),
		draft: draftRepository,
		draftPullRequest: draftPullRequestRepository,
		permissionStore,
		approvalStore,
		logStoreManager,
		// Placeholder — replaced after binding (needs bound repos for LogCollector)
		devServer: {} as Repos["devServer"],
	};

	// 2. Bind all repos once
	const fullCtx = createFullCtx(db);
	const repos = bindRepos(rawRepos, fullCtx);

	// 3. Create DevServerRepository with bound LogCollector, then rebind
	const logCollector = new LogCollector(repos.devServerProcessLogs, logger);
	const devServer = new DevServerRepository(
		logger,
		logCollector,
		callbackClient,
	);
	rawRepos.devServer = devServer;
	repos.devServer = bindCtx(devServer, fullCtx);

	// 4. Build context and initialize callback client
	const ctx: Context = {
		now: new Date(),
		logger,
		db,
		rawRepos,
		repos,
	};

	callbackClient.initialize(ctx);

	return ctx;
}
