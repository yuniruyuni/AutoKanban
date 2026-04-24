import type { PgDatabase } from "./infra/db/pg-client";
import type { ILogger } from "./infra/logger/types";
import { detectDevServerUrl } from "./models/preview-url";
import { CallbackClientImpl } from "./presentation/callback/impl";
import { bindCtx, bindRepos, type Repos } from "./repositories";
import { AgentConfigRepository } from "./repositories/agent-config";
import { AgentSettingRepository } from "./repositories/agent-setting/postgres";
import { ApprovalRepository } from "./repositories/approval/postgres";
import { approvalStore } from "./repositories/approval-store";
import { CodingAgentProcessRepository } from "./repositories/coding-agent-process/postgres";
import { CodingAgentProcessLogsRepository } from "./repositories/coding-agent-process-logs/postgres";
import { CodingAgentTurnRepository } from "./repositories/coding-agent-turn/postgres";
import { createFullCtx, createServiceCtx } from "./repositories/common";
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
import { PreviewProxyRepository } from "./repositories/preview-proxy";
import { ProjectRepository } from "./repositories/project/postgres";
import { ScriptRunnerRepository } from "./repositories/script-runner";
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

	// Check agent availability at startup
	for (const driver of drivers.values()) {
		const path = Bun.which(driver.defaultCommand);
		if (path) {
			logger.info(`${driver.displayName} found: ${path}`);
		} else {
			logger.warn(
				`${driver.displayName} not found in PATH. Install with: ${driver.installHint}`,
			);
		}
	}

	// 1. Construct all raw repos
	const rawRepos: Repos = {
		agentSetting: new AgentSettingRepository(),
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
		scriptRunner: new ScriptRunnerRepository(),
		draft: draftRepository,
		draftPullRequest: draftPullRequestRepository,
		permissionStore,
		approvalStore,
		logStoreManager,
		// Placeholder — replaced after binding (needs bound repos for LogCollector)
		devServer: {} as Repos["devServer"],
		previewProxy: new PreviewProxyRepository(logger),
	};

	// 2. Bind all repos once
	const fullCtx = createFullCtx(db);
	const repos = bindRepos(rawRepos, fullCtx);

	// 3. Create DevServerRepository with bound LogCollectors, then rebind.
	// One collector per logs table: dev server vs. workspace script. They share
	// the same spawn machinery but persist to FK-distinct tables, so we must
	// route each process kind to the correct logs repo or the database will
	// reject inserts (FK violation -> unhandled promise rejection).
	//
	// The dev-server collector also watches output for the first URL the
	// child prints and hands it to PreviewProxy as the proxy target, so the
	// viewer's iframe starts forwarding real responses as soon as the dev
	// server is up. Workspace-script processes don't need a proxy target.
	const previewProxy = rawRepos.previewProxy;
	const devServerLogCollector = new LogCollector(
		repos.devServerProcessLogs,
		logger,
		(processId, _source, data) => {
			const svc = createServiceCtx();
			if (previewProxy.getTarget(svc, processId)) return;
			const url = detectDevServerUrl(data);
			if (url) previewProxy.setTarget(svc, processId, url);
		},
	);
	const workspaceScriptLogCollector = new LogCollector(
		repos.workspaceScriptProcessLogs,
		logger,
	);
	const devServer = new DevServerRepository(
		logger,
		{
			devserver: devServerLogCollector,
			workspacescript: workspaceScriptLogCollector,
		},
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
