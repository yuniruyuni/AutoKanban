import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PgDatabase } from "../../server/src/infra/db/pg-client";
import type { ILogger } from "../../server/src/infra/logger/types";
import { CallbackClientImpl } from "../../server/src/presentation/callback/impl";
import {
	bindCtx,
	bindRepos,
	createFullCtx,
	type Repos,
} from "../../server/src/repositories";
import { AgentRepository } from "../../server/src/repositories/agent";
import { AgentConfigRepository } from "../../server/src/repositories/agent-config";
import { AgentSettingRepository } from "../../server/src/repositories/agent-setting/postgres";
import { ApprovalRepository } from "../../server/src/repositories/approval/postgres";
import { approvalStore } from "../../server/src/repositories/approval-store";
import { CodingAgentProcessRepository } from "../../server/src/repositories/coding-agent-process/postgres";
import { CodingAgentProcessLogsRepository } from "../../server/src/repositories/coding-agent-process-logs/postgres";
import { CodingAgentTurnRepository } from "../../server/src/repositories/coding-agent-turn/postgres";
import { DevServerRepository } from "../../server/src/repositories/dev-server";
import { DevServerProcessRepository } from "../../server/src/repositories/dev-server-process/postgres";
import { DevServerProcessLogsRepository } from "../../server/src/repositories/dev-server-process-logs/postgres";
import { draftRepository } from "../../server/src/repositories/draft";
import { draftPullRequestRepository } from "../../server/src/repositories/draft-pull-request";
import { GitRepository } from "../../server/src/repositories/git";
import { LogCollector } from "../../server/src/repositories/log-collector";
import { logStoreManager } from "../../server/src/repositories/log-store";
import { messageQueueRepository } from "../../server/src/repositories/message-queue";
import { permissionStore } from "../../server/src/repositories/permission-store";
import { PreviewProxyRepository } from "../../server/src/repositories/preview-proxy";
import { ProjectRepository } from "../../server/src/repositories/project/postgres";
import { ScriptRunnerRepository } from "../../server/src/repositories/script-runner";
import { SessionRepository } from "../../server/src/repositories/session/postgres";
import { TaskRepository } from "../../server/src/repositories/task/postgres";
import { TaskTemplateRepository } from "../../server/src/repositories/task-template/postgres";
import { ToolRepository } from "../../server/src/repositories/tool/postgres";
import { VariantRepository } from "../../server/src/repositories/variant/postgres";
import { WorkspaceRepository } from "../../server/src/repositories/workspace/postgres";
import { WorkspaceConfigRepository } from "../../server/src/repositories/workspace-config";
import { WorkspaceRepoRepository } from "../../server/src/repositories/workspace-repo/postgres";
import { WorkspaceScriptProcessRepository } from "../../server/src/repositories/workspace-script-process/postgres";
import { WorkspaceScriptProcessLogsRepository } from "../../server/src/repositories/workspace-script-process-logs/postgres";
import { WorktreeRepository } from "../../server/src/repositories/worktree";
import type { Context } from "../../server/src/usecases/context";

/**
 * Create mock executor that succeeds without spawning real processes.
 */
function createMockExecutor(): Repos["executor"] {
	const processes = new Map<
		string,
		{ id: string; sessionId: string; startedAt: Date }
	>();

	return {
		async start(_ctx, options) {
			const info = {
				id: options.id ?? crypto.randomUUID(),
				sessionId: options.sessionId,
				runReason: options.runReason,
				startedAt: new Date(),
			};
			processes.set(info.id, info);
			return info;
		},
		async startProtocol(_ctx, options) {
			const info = {
				id: options.id ?? crypto.randomUUID(),
				sessionId: options.sessionId,
				runReason: options.runReason,
				startedAt: new Date(),
			};
			processes.set(info.id, info);
			return info;
		},
		async stop(_ctx, processId) {
			return processes.delete(processId);
		},
		async kill(_ctx, processId) {
			return processes.delete(processId);
		},
		async sendMessage() {
			return true;
		},
		async sendPermissionResponse() {
			return true;
		},
		async startProtocolAndWait(_ctx, options) {
			const info = {
				id: options.id ?? crypto.randomUUID(),
				sessionId: options.sessionId,
				runReason: options.runReason,
				startedAt: new Date(),
			};
			processes.set(info.id, info);
			return { exitCode: 0 };
		},
		spawnStructured() {
			return null;
		},
		async runStructured() {
			return null;
		},
		get(_ctx, processId) {
			return processes.get(processId) as
				| {
						id: string;
						sessionId: string;
						runReason: "codingagent";
						startedAt: Date;
				  }
				| undefined;
		},
		getBySession(_ctx, sessionId) {
			return [...processes.values()].filter(
				(p) => p.sessionId === sessionId,
			) as Array<{
				id: string;
				sessionId: string;
				runReason: "codingagent";
				startedAt: Date;
			}>;
		},
		getStdout() {
			return null;
		},
		getStderr() {
			return null;
		},
		getDriverInfo(_ctx: unknown, executorName: string) {
			const defaults: Record<string, string> = {
				"claude-code": "claude",
				"gemini-cli": "gemini",
			};
			const cmd = defaults[executorName];
			return cmd ? { defaultCommand: cmd } : null;
		},
	} as Repos["executor"];
}

let worktreeBaseDir: string | null = null;

export async function getWorktreeBaseDir(): Promise<string> {
	if (!worktreeBaseDir) {
		worktreeBaseDir = await mkdtemp(join(tmpdir(), "e2e-worktrees-"));
	}
	return worktreeBaseDir;
}

/**
 * Create an E2E context with:
 * - Real DB repos (all PostgreSQL repos)
 * - Real git repo (for git operations)
 * - Real worktree repo (with temp baseDir)
 * - Mock executor (no-op, no real agent process)
 */
export async function createE2EContext(
	db: PgDatabase,
	logger: ILogger,
): Promise<Context> {
	const callbackClient = new CallbackClientImpl();
	const baseDir = await getWorktreeBaseDir();

	const rawRepos: Repos = {
		agent: new AgentRepository(),
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
		worktree: new WorktreeRepository(logger, baseDir),
		executor: createMockExecutor(),
		messageQueue: messageQueueRepository,
		agentConfig: new AgentConfigRepository(),
		workspaceConfig: new WorkspaceConfigRepository(),
		scriptRunner: new ScriptRunnerRepository(),
		draft: draftRepository,
		draftPullRequest: draftPullRequestRepository,
		permissionStore,
		approvalStore,
		logStoreManager,
		devServer: {} as Repos["devServer"],
		previewProxy: new PreviewProxyRepository(logger),
	};

	const fullCtx = createFullCtx(db);
	const repos = bindRepos(rawRepos, fullCtx);

	const devServerLogCollector = new LogCollector(
		repos.devServerProcessLogs,
		logger,
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
