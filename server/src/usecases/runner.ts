import type { PgDatabase } from "../db/pg-client";
import { type Fail, fail, isFail, type Unfail } from "../models/common";
import { ApprovalRepository } from "../repositories/approval";
import { CodingAgentTurnRepository } from "../repositories/coding-agent-turn";
import { ExecutionProcessRepository } from "../repositories/execution-process";
import { ExecutionProcessLogsRepository } from "../repositories/execution-process-logs";
import { ProjectRepository } from "../repositories/project";
import { SessionRepository } from "../repositories/session";
import { TaskRepository } from "../repositories/task";
import { TaskTemplateRepository } from "../repositories/task-template";
import { ToolRepository } from "../repositories/tool";
import { VariantRepository } from "../repositories/variant";
import { WorkspaceRepository } from "../repositories/workspace";
import { WorkspaceConfigRepository } from "../repositories/workspace-config";
import { WorkspaceRepoRepository } from "../repositories/workspace-repo";
import type {
	Context,
	PostContext,
	PreContext,
	ProcessContext,
	ReadContext,
	Repos,
	WriteContext,
} from "../types/context";

// Re-export context types for convenience
export type {
	Context,
	PostContext,
	PreContext,
	ProcessContext,
	ReadContext,
	WriteContext,
} from "../types/context";

// ============================================
// Result type
// ============================================

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

// ============================================
// Usecase type
// ============================================

export interface Usecase<T> {
	run(ctx: Context): Promise<Result<T, Fail>>;
}

// ============================================
// Usecase Definition
// ============================================

type MaybePromise<T> = T | Promise<T>;

interface UsecaseDefinition<TPre, TRead, TProcess, TWrite, TPost, TResult> {
	pre?: (ctx: PreContext) => MaybePromise<TPre | Fail>;
	read?: (ctx: ReadContext, state: Unfail<TPre>) => MaybePromise<TRead | Fail>;
	process?: (
		ctx: ProcessContext,
		state: Unfail<TRead>,
	) => MaybePromise<TProcess | Fail>;
	write?: (
		ctx: WriteContext,
		state: Unfail<TProcess>,
	) => MaybePromise<TWrite | Fail>;
	post?: (
		ctx: PostContext,
		state: Unfail<TWrite>,
	) => MaybePromise<TPost | Fail>;
	result?: (state: Unfail<TPost>) => MaybePromise<TResult>;
}

// ============================================
// Transaction-scoped repository creation
// ============================================

function createTransactionRepos(repos: Repos, tx: PgDatabase): Repos {
	return {
		// DB-backed: recreate with transaction-scoped PgDatabase
		task: new TaskRepository(tx),
		taskTemplate: new TaskTemplateRepository(tx),
		project: new ProjectRepository(tx),
		workspace: new WorkspaceRepository(tx),
		workspaceRepo: new WorkspaceRepoRepository(tx),
		session: new SessionRepository(tx),
		executionProcess: new ExecutionProcessRepository(tx),
		executionProcessLogs: new ExecutionProcessLogsRepository(tx),
		codingAgentTurn: new CodingAgentTurnRepository(tx),
		tool: new ToolRepository(tx),
		variant: new VariantRepository(tx),
		approval: new ApprovalRepository(tx),
		// Non-DB: pass through
		git: repos.git,
		worktree: repos.worktree,
		executor: repos.executor,
		messageQueue: repos.messageQueue,
		agentConfig: repos.agentConfig,
		workspaceConfig: repos.workspaceConfig,
		draft: repos.draft,
		permissionStore: repos.permissionStore,
		approvalStore: repos.approvalStore,
		logStoreManager: repos.logStoreManager,
		devServer: repos.devServer,
	};
}

// ============================================
// usecase function
// ============================================

export function usecase<
	TPre = Record<string, never>,
	TRead = TPre,
	TProcess = TRead,
	TWrite = TProcess,
	TPost = TWrite,
	TResult = TPost,
>(
	def: UsecaseDefinition<TPre, TRead, TProcess, TWrite, TPost, TResult>,
): Usecase<TResult> {
	return {
		async run(ctx: Context): Promise<Result<TResult, Fail>> {
			try {
				const preCtx: PreContext = { now: ctx.now, logger: ctx.logger };
				const processCtx: ProcessContext = { now: ctx.now, logger: ctx.logger };
				const postCtx: PostContext = {
					now: ctx.now,
					logger: ctx.logger,
					repos: ctx.repos,
				};

				// pre (outside transaction)
				let state: unknown = await (def.pre?.(preCtx) ?? {});
				if (isFail(state)) return { ok: false, error: state };

				// read → process → write (transaction scope depends on steps)
				if (def.write) {
					// Write transaction: read → process → write
					state = await ctx.db.transaction(async (tx) => {
						return runReadProcessWrite(ctx, def, processCtx, tx, state);
					});
				} else if (def.read) {
					// Read-only transaction: read → process
					state = await ctx.db.readTransaction(async (tx) => {
						return runReadProcessWrite(ctx, def, processCtx, tx, state);
					});
				} else {
					// No DB steps: process only (no transaction)
					state = await (def.process?.(
						processCtx,
						state as Unfail<TRead>,
					) ?? state);
				}
				if (isFail(state)) return { ok: false, error: state };

				// post (outside transaction)
				state = await (def.post?.(postCtx, state as Unfail<TWrite>) ?? state);
				if (isFail(state)) return { ok: false, error: state };

				// result
				const result = await (def.result?.(state as Unfail<TPost>) ?? state);
				return { ok: true, value: result as TResult };
			} catch (error) {
				ctx.logger.error("Unexpected error in usecase:", error);
				return {
					ok: false,
					error: fail("INTERNAL", "An unexpected error occurred"),
				};
			}
		},
	};
}

function runReadProcessWrite<TPre, TRead, TProcess, TWrite, TPost, TResult>(
	ctx: Context,
	def: UsecaseDefinition<TPre, TRead, TProcess, TWrite, TPost, TResult>,
	processCtx: ProcessContext,
	tx: PgDatabase,
	state: unknown,
): MaybePromise<unknown> {
	const reposFactory = ctx.createTransactionRepos ?? createTransactionRepos;
	const txRepos = reposFactory(ctx.repos, tx);
	const readCtx: ReadContext = {
		now: ctx.now,
		logger: ctx.logger,
		repos: txRepos,
	};
	const writeCtx: WriteContext = {
		now: ctx.now,
		logger: ctx.logger,
		repos: txRepos,
	};

	return (async () => {
		let s: unknown = await (def.read?.(readCtx, state as Unfail<TPre>) ??
			state);
		if (isFail(s)) return s;

		s = await (def.process?.(processCtx, s as Unfail<TRead>) ?? s);
		if (isFail(s)) return s;

		s = await (def.write?.(writeCtx, s as Unfail<TProcess>) ?? s);
		return s;
	})();
}
