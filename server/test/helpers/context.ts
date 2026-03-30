import type { PgDatabase } from "../../src/db/pg-client";
import type { ILogStreamer } from "../../src/presentation/log-streamer";
import { ApprovalRepository } from "../../src/repositories/approval";
import { CodingAgentTurnRepository } from "../../src/repositories/coding-agent-turn";
import { ExecutionProcessRepository } from "../../src/repositories/execution-process";
import { ExecutionProcessLogsRepository } from "../../src/repositories/execution-process-logs";
import { ProjectRepository } from "../../src/repositories/project";
import { SessionRepository } from "../../src/repositories/session";
import { TaskRepository } from "../../src/repositories/task";
import { WorkspaceRepository } from "../../src/repositories/workspace";
import { WorkspaceRepoRepository } from "../../src/repositories/workspace-repo";
import type {
	Context,
	DbRepoDefs,
	ExternalRepos,
	Repos,
} from "../../src/types/context";
import { bindDbCtx, createDbWriteCtx } from "../../src/types/db-capability";
import { createMockLogger } from "./logger";

const DB_REPO_KEYS = [
	"task",
	"taskTemplate",
	"project",
	"workspace",
	"workspaceRepo",
	"session",
	"executionProcess",
	"executionProcessLogs",
	"codingAgentTurn",
	"tool",
	"variant",
	"approval",
] as const;

const EXTERNAL_REPO_KEYS = [
	"git",
	"worktree",
	"executor",
	"messageQueue",
	"agentConfig",
	"workspaceConfig",
	"draft",
	"permissionStore",
	"approvalStore",
	"logStoreManager",
	"devServer",
] as const;

/**
 * Build rawDbRepos from stripped repo overrides.
 * Each override method is wrapped to accept (and ignore) the DbCtx first arg.
 * When runner.ts calls bindDbCtx(rawRepo, ctx), the ctx is added then stripped,
 * delegating to the original mock method.
 */
function createMockRawDbRepos(repoOverrides: Partial<Repos>): DbRepoDefs {
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
	return raw as unknown as DbRepoDefs;
}

function createMockExternalRepos(repoOverrides: Partial<Repos>): ExternalRepos {
	const ext: Record<string, unknown> = {};
	for (const key of EXTERNAL_REPO_KEYS) {
		const override = (repoOverrides as Record<string, unknown>)[key];
		if (override) {
			ext[key] = override;
		} else {
			ext[key] = new Proxy(
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
	return ext as unknown as ExternalRepos;
}

/**
 * Create a mock context for usecase unit tests.
 * Repo overrides use the stripped interface (no DbCtx first arg).
 * Internally, rawDbRepos wraps them to accept DbCtx.
 */
export function createMockContext(repoOverrides: Partial<Repos> = {}): Context {
	const mockDb = {
		transaction: async <T>(fn: (tx: PgDatabase) => Promise<T>) =>
			fn({} as PgDatabase),
		readTransaction: async <T>(fn: (tx: PgDatabase) => Promise<T>) =>
			fn({} as PgDatabase),
	} as PgDatabase;

	const rawDbRepos = createMockRawDbRepos(repoOverrides);
	const externalRepos = createMockExternalRepos(repoOverrides);

	// repos (Proxy) for PostContext which accesses ctx.repos directly
	const handler: ProxyHandler<Repos> = {
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
		rawDbRepos,
		externalRepos,
		repos: new Proxy({} as Repos, handler),
		logStreamer: {} as ILogStreamer,
	};
}

/**
 * Create an integration context with real DB repositories.
 * External system repos (git, worktree, executor, etc.) are mocked.
 */
export function createIntegrationContext(db: PgDatabase): Context {
	const rawDbRepos: DbRepoDefs = {
		task: new TaskRepository(),
		taskTemplate: {} as DbRepoDefs["taskTemplate"],
		project: new ProjectRepository(),
		workspace: new WorkspaceRepository(),
		session: new SessionRepository(),
		executionProcess: new ExecutionProcessRepository(),
		executionProcessLogs: new ExecutionProcessLogsRepository(),
		workspaceRepo: new WorkspaceRepoRepository(),
		codingAgentTurn: new CodingAgentTurnRepository(),
		approval: new ApprovalRepository(),
		tool: {} as DbRepoDefs["tool"],
		variant: {} as DbRepoDefs["variant"],
	};

	const externalRepos: ExternalRepos = {
		git: {} as ExternalRepos["git"],
		worktree: {} as ExternalRepos["worktree"],
		executor: {} as ExternalRepos["executor"],
		messageQueue: {} as ExternalRepos["messageQueue"],
		agentConfig: {} as ExternalRepos["agentConfig"],
		workspaceConfig: {} as ExternalRepos["workspaceConfig"],
		draft: {} as ExternalRepos["draft"],
		permissionStore: {} as ExternalRepos["permissionStore"],
		approvalStore: {} as ExternalRepos["approvalStore"],
		logStoreManager: {} as ExternalRepos["logStoreManager"],
		devServer: {} as ExternalRepos["devServer"],
	};

	const dbCtx = createDbWriteCtx(db);
	const repos: Repos = {
		task: bindDbCtx(rawDbRepos.task, dbCtx),
		taskTemplate: {} as Repos["taskTemplate"],
		project: bindDbCtx(rawDbRepos.project, dbCtx),
		workspace: bindDbCtx(rawDbRepos.workspace, dbCtx),
		session: bindDbCtx(rawDbRepos.session, dbCtx),
		executionProcess: bindDbCtx(rawDbRepos.executionProcess, dbCtx),
		executionProcessLogs: bindDbCtx(rawDbRepos.executionProcessLogs, dbCtx),
		workspaceRepo: bindDbCtx(rawDbRepos.workspaceRepo, dbCtx),
		codingAgentTurn: bindDbCtx(rawDbRepos.codingAgentTurn, dbCtx),
		approval: bindDbCtx(rawDbRepos.approval, dbCtx),
		tool: {} as Repos["tool"],
		variant: {} as Repos["variant"],
		...externalRepos,
	};

	return {
		now: new Date("2025-01-15T10:00:00.000Z"),
		logger: createMockLogger(),
		db,
		rawDbRepos,
		externalRepos,
		repos,
		logStreamer: {} as ILogStreamer,
	};
}
