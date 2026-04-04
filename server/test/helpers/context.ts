import type { Database } from "../../src/infra/db/database";
import type { Repos } from "../../src/repositories";
import { AgentSettingRepository } from "../../src/repositories/agent-setting/postgres";
import { ApprovalRepository } from "../../src/repositories/approval/postgres";
import { CodingAgentProcessRepository } from "../../src/repositories/coding-agent-process/postgres";
import { CodingAgentProcessLogsRepository } from "../../src/repositories/coding-agent-process-logs/postgres";
import { CodingAgentTurnRepository } from "../../src/repositories/coding-agent-turn/postgres";
import type { FullRepos } from "../../src/repositories/common";
import { bindCtx, createDbWriteCtx } from "../../src/repositories/common";
import { DevServerProcessRepository } from "../../src/repositories/dev-server-process/postgres";
import { DevServerProcessLogsRepository } from "../../src/repositories/dev-server-process-logs/postgres";
import { ProjectRepository } from "../../src/repositories/project/postgres";
import { SessionRepository } from "../../src/repositories/session/postgres";
import { TaskRepository } from "../../src/repositories/task/postgres";
import { WorkspaceRepository } from "../../src/repositories/workspace/postgres";
import { WorkspaceRepoRepository } from "../../src/repositories/workspace-repo/postgres";
import { WorkspaceScriptProcessRepository } from "../../src/repositories/workspace-script-process/postgres";
import { WorkspaceScriptProcessLogsRepository } from "../../src/repositories/workspace-script-process-logs/postgres";
import type { Context } from "../../src/usecases/context";
import { createMockLogger } from "./logger";

const DB_REPO_KEYS = [
	"agentSetting",
	"task",
	"taskTemplate",
	"project",
	"workspace",
	"workspaceRepo",
	"session",
	"codingAgentProcess",
	"codingAgentProcessLogs",
	"devServerProcess",
	"devServerProcessLogs",
	"workspaceScriptProcess",
	"workspaceScriptProcessLogs",
	"codingAgentTurn",
	"tool",
	"variant",
	"approval",
] as const;

/**
 * Build rawRepos from stripped repo overrides.
 * Each override method is wrapped to accept (and ignore) the ctx first arg.
 * When runner.ts calls bindCtx(rawRepo, ctx), the ctx is added then stripped,
 * delegating to the original mock method.
 */
function createMockRawRepos(repoOverrides: Partial<FullRepos<Repos>>): Repos {
	const raw: Record<string, unknown> = {};
	for (const key of DB_REPO_KEYS) {
		const override = (repoOverrides as Record<string, unknown>)[key];
		if (override && typeof override === "object") {
			raw[key] = new Proxy(override, {
				get(target, prop, receiver) {
					const method = Reflect.get(target, prop, receiver);
					if (typeof method === "function") {
						return (_ctx: unknown, ...args: unknown[]) =>
							method.apply(target, args);
					}
					return method;
				},
			});
		} else {
			raw[key] = new Proxy(
				{},
				{
					get(_, method: string) {
						return () => {
							throw new Error(`Unexpected repo call: repos.${key}.${method}()`);
						};
					},
				},
			);
		}
	}

	// External repos
	const externalKeys = [
		"git",
		"worktree",
		"executor",
		"messageQueue",
		"agentConfig",
		"workspaceConfig",
		"draft",
		"draftPullRequest",
		"permissionStore",
		"approvalStore",
		"logStoreManager",
		"scriptRunner",
		"devServer",
	] as const;

	for (const key of externalKeys) {
		const override = (repoOverrides as Record<string, unknown>)[key];
		if (override && typeof override === "object") {
			// Wrap external repo mocks the same way as DB repos:
			// accept (and ignore) the ctx marker as the first argument.
			raw[key] = new Proxy(override, {
				get(target, prop, receiver) {
					const method = Reflect.get(target, prop, receiver);
					if (typeof method === "function") {
						return (_ctx: unknown, ...args: unknown[]) =>
							method.apply(target, args);
					}
					return method;
				},
			});
		} else if (override) {
			raw[key] = override;
		} else {
			raw[key] = new Proxy(
				{},
				{
					get(_, method: string) {
						return () => {
							throw new Error(`Unexpected repo call: repos.${key}.${method}()`);
						};
					},
				},
			);
		}
	}

	return raw as unknown as Repos;
}

/**
 * Create a mock context for usecase unit tests.
 * Repo overrides use the stripped interface (no ctx first arg).
 * Internally, rawRepos wraps them to accept ctx.
 */
export function createMockContext(
	repoOverrides: Partial<FullRepos<Repos>> = {},
): Context {
	const mockDb = {
		transaction: async <T>(fn: (tx: Database) => Promise<T>) =>
			fn({} as Database),
		readTransaction: async <T>(fn: (tx: Database) => Promise<T>) =>
			fn({} as Database),
	} as Database;

	const rawRepos = createMockRawRepos(repoOverrides);

	// repos (Proxy) for PostContext which accesses ctx.repos directly
	const handler: ProxyHandler<FullRepos<Repos>> = {
		get(_, prop: string | symbol) {
			if (typeof prop === "string" && prop in repoOverrides) {
				return (repoOverrides as Record<string, unknown>)[prop];
			}
			return new Proxy(
				{},
				{
					get(_, method: string) {
						return () => {
							throw new Error(
								`Unexpected repo call: repos.${String(prop)}.${method}()`,
							);
						};
					},
				},
			);
		},
	};

	return {
		now: new Date("2025-01-15T10:00:00.000Z"),
		logger: createMockLogger(),
		db: mockDb,
		rawRepos,
		repos: new Proxy({} as FullRepos<Repos>, handler),
	};
}

/**
 * Create an integration context with real DB repositories.
 * External system repos (git, worktree, executor, etc.) are mocked.
 */
export function createIntegrationContext(db: Database): Context {
	const rawRepos: Repos = {
		agentSetting: new AgentSettingRepository(),
		task: new TaskRepository(),
		taskTemplate: {} as Repos["taskTemplate"],
		project: new ProjectRepository(),
		workspace: new WorkspaceRepository(),
		session: new SessionRepository(),
		codingAgentProcess: new CodingAgentProcessRepository(),
		codingAgentProcessLogs: new CodingAgentProcessLogsRepository(),
		devServerProcess: new DevServerProcessRepository(),
		devServerProcessLogs: new DevServerProcessLogsRepository(),
		workspaceScriptProcess: new WorkspaceScriptProcessRepository(),
		workspaceScriptProcessLogs: new WorkspaceScriptProcessLogsRepository(),
		workspaceRepo: new WorkspaceRepoRepository(),
		codingAgentTurn: new CodingAgentTurnRepository(),
		approval: new ApprovalRepository(),
		tool: {} as Repos["tool"],
		variant: {} as Repos["variant"],
		git: {} as Repos["git"],
		worktree: {} as Repos["worktree"],
		executor: {} as Repos["executor"],
		messageQueue: {} as Repos["messageQueue"],
		agentConfig: {} as Repos["agentConfig"],
		workspaceConfig: {} as Repos["workspaceConfig"],
		scriptRunner: {} as Repos["scriptRunner"],
		draft: {} as Repos["draft"],
		draftPullRequest: {} as Repos["draftPullRequest"],
		permissionStore: {} as Repos["permissionStore"],
		approvalStore: {} as Repos["approvalStore"],
		logStoreManager: {} as Repos["logStoreManager"],
		devServer: {} as Repos["devServer"],
	};

	const dbCtx = createDbWriteCtx(db);
	const repos = {
		agentSetting: bindCtx(rawRepos.agentSetting, dbCtx),
		task: bindCtx(rawRepos.task, dbCtx),
		taskTemplate: {} as FullRepos<Repos>["taskTemplate"],
		project: bindCtx(rawRepos.project, dbCtx),
		workspace: bindCtx(rawRepos.workspace, dbCtx),
		session: bindCtx(rawRepos.session, dbCtx),
		codingAgentProcess: bindCtx(rawRepos.codingAgentProcess, dbCtx),
		codingAgentProcessLogs: bindCtx(rawRepos.codingAgentProcessLogs, dbCtx),
		devServerProcess: bindCtx(rawRepos.devServerProcess, dbCtx),
		devServerProcessLogs: bindCtx(rawRepos.devServerProcessLogs, dbCtx),
		workspaceScriptProcess: bindCtx(rawRepos.workspaceScriptProcess, dbCtx),
		workspaceScriptProcessLogs: bindCtx(
			rawRepos.workspaceScriptProcessLogs,
			dbCtx,
		),
		workspaceRepo: bindCtx(rawRepos.workspaceRepo, dbCtx),
		codingAgentTurn: bindCtx(rawRepos.codingAgentTurn, dbCtx),
		approval: bindCtx(rawRepos.approval, dbCtx),
		tool: {} as FullRepos<Repos>["tool"],
		variant: {} as FullRepos<Repos>["variant"],
		git: {} as FullRepos<Repos>["git"],
		worktree: {} as FullRepos<Repos>["worktree"],
		executor: {} as FullRepos<Repos>["executor"],
		messageQueue: {} as FullRepos<Repos>["messageQueue"],
		agentConfig: {} as FullRepos<Repos>["agentConfig"],
		workspaceConfig: {} as FullRepos<Repos>["workspaceConfig"],
		scriptRunner: {} as FullRepos<Repos>["scriptRunner"],
		draft: {} as FullRepos<Repos>["draft"],
		permissionStore: {} as FullRepos<Repos>["permissionStore"],
		approvalStore: {} as FullRepos<Repos>["approvalStore"],
		logStoreManager: {} as FullRepos<Repos>["logStoreManager"],
		devServer: {} as FullRepos<Repos>["devServer"],
	} as FullRepos<Repos>;

	return {
		now: new Date("2025-01-15T10:00:00.000Z"),
		logger: createMockLogger(),
		db,
		rawRepos,
		repos,
	};
}
