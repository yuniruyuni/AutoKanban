import type { PgDatabase } from "./repositories/common";
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
import { setupQueueProcessor } from "./usecases/execution/queue-processor";
import type { Context } from "./usecases/context";
import { bindRepos } from "./repositories";
import { createFullCtx } from "./repositories/common";
import type { ILogger } from "./lib/logger/types";

export function createContext(db: PgDatabase, logger: ILogger): Context {
	// Create DB repositories (stateless)
	const taskRepo = new TaskRepository();
	const taskTemplateRepo = new TaskTemplateRepository();
	const projectRepo = new ProjectRepository();
	const workspaceRepo = new WorkspaceRepository();
	const workspaceRepoRepo = new WorkspaceRepoRepository();
	const sessionRepo = new SessionRepository();
	const executionProcessRepo = new ExecutionProcessRepository();
	const executionProcessLogsRepo = new ExecutionProcessLogsRepository();
	const codingAgentTurnRepo = new CodingAgentTurnRepository();
	const toolRepo = new ToolRepository();
	const variantRepo = new VariantRepository();
	const approvalRepo = new ApprovalRepository();

	// Bind with pool-level ctx for orchestrator dependencies
	const fullCtx = createFullCtx(db);
	const boundEpRepo = bindRepos(
		{ executionProcess: executionProcessRepo } as any,
		fullCtx,
	).executionProcess;
	const boundCatRepo = bindRepos(
		{ codingAgentTurn: codingAgentTurnRepo } as any,
		fullCtx,
	).codingAgentTurn;
	const boundEpLogsRepo = bindRepos(
		{ executionProcessLogs: executionProcessLogsRepo } as any,
		fullCtx,
	).executionProcessLogs;

	// Create executor (needs bound DB repos for internal use)
	const drivers = new Map();
	drivers.set("claude-code", new ClaudeCodeDriver(logger));
	drivers.set("gemini-cli", new GeminiCliDriver(logger));
	const executor = new ExecutorRepository(
		boundEpRepo,
		boundCatRepo,
		drivers,
		boundEpLogsRepo,
		logger,
	);

	// Wire up approval dependencies
	const boundApprovalRepo = bindRepos(
		{ approval: approvalRepo } as any,
		fullCtx,
	).approval;
	const boundApprovalStore = bindRepos(
		{ approvalStore } as any,
		fullCtx,
	).approvalStore;
	const boundTaskRepo = bindRepos(
		{ task: taskRepo } as any,
		fullCtx,
	).task;
	const boundSessionRepo = bindRepos(
		{ session: sessionRepo } as any,
		fullCtx,
	).session;
	const boundWorkspaceRepo = bindRepos(
		{ workspace: workspaceRepo } as any,
		fullCtx,
	).workspace;

	executor.setApprovalDeps({
		approvalRepo: boundApprovalRepo,
		approvalStore: boundApprovalStore,
		taskRepo: boundTaskRepo,
		sessionRepo: boundSessionRepo,
		workspaceRepo: boundWorkspaceRepo,
	});

	// Assemble all raw repos (all defined, no undefined)
	const rawRepos = {
		task: taskRepo,
		taskTemplate: taskTemplateRepo,
		project: projectRepo,
		workspace: workspaceRepo,
		workspaceRepo: workspaceRepoRepo,
		session: sessionRepo,
		executionProcess: executionProcessRepo,
		executionProcessLogs: executionProcessLogsRepo,
		codingAgentTurn: codingAgentTurnRepo,
		tool: toolRepo,
		variant: variantRepo,
		approval: approvalRepo,
		git: new GitRepository(),
		worktree: new WorktreeRepository(logger),
		executor,
		messageQueue: messageQueueRepository,
		agentConfig: new AgentConfigRepository(),
		workspaceConfig: new WorkspaceConfigRepository(),
		draft: draftRepository,
		permissionStore,
		approvalStore,
		logStoreManager,
		devServer: new DevServerRepository(boundEpLogsRepo, logger),
	};

	// Bind all repos with full ctx
	const repos = bindRepos(rawRepos, fullCtx);

	// Set up queue processor
	setupQueueProcessor(executor, repos, logger);

	return {
		now: new Date(),
		logger,
		db,
		rawRepos,
		repos,
	};
}
