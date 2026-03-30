import { type Fail, fail, isFail, type Unfail } from "../models/common";
import type {
	Context,
	PostContext,
	PreContext,
	ProcessContext,
	ReadContext,
	WriteContext,
} from "../types/context";
import {
	bindCtx,
	createDbReadCtx,
	createDbWriteCtx,
	type DbReadCtx,
	type DbReadRepos,
	type DbWriteCtx,
	type DbWriteRepos,
} from "../repositories/common";
import type { Repos } from "../repositories";

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
// Repo binding helpers
// ============================================

function bindReadRepos(raw: Repos, dbCtx: DbReadCtx): DbReadRepos<Repos> {
	return {
		// DB repos: bind with DbReadCtx to extract read-only methods
		task: bindCtx(raw.task, dbCtx),
		taskTemplate: bindCtx(raw.taskTemplate, dbCtx),
		project: bindCtx(raw.project, dbCtx),
		workspace: bindCtx(raw.workspace, dbCtx),
		workspaceRepo: bindCtx(raw.workspaceRepo, dbCtx),
		session: bindCtx(raw.session, dbCtx),
		executionProcess: bindCtx(raw.executionProcess, dbCtx),
		executionProcessLogs: bindCtx(raw.executionProcessLogs, dbCtx),
		codingAgentTurn: bindCtx(raw.codingAgentTurn, dbCtx),
		tool: bindCtx(raw.tool, dbCtx),
		variant: bindCtx(raw.variant, dbCtx),
		approval: bindCtx(raw.approval, dbCtx),
		// External repos: DbRead extracts nothing (ServiceCtx methods excluded)
		git: bindCtx(raw.git, dbCtx),
		worktree: bindCtx(raw.worktree, dbCtx),
		executor: bindCtx(raw.executor, dbCtx),
		messageQueue: bindCtx(raw.messageQueue, dbCtx),
		agentConfig: bindCtx(raw.agentConfig, dbCtx),
		workspaceConfig: bindCtx(raw.workspaceConfig, dbCtx),
		draft: bindCtx(raw.draft, dbCtx),
		permissionStore: bindCtx(raw.permissionStore, dbCtx),
		approvalStore: bindCtx(raw.approvalStore, dbCtx),
		logStoreManager: bindCtx(raw.logStoreManager, dbCtx),
		devServer: bindCtx(raw.devServer, dbCtx),
	};
}

function bindWriteRepos(raw: Repos, dbCtx: DbWriteCtx): DbWriteRepos<Repos> {
	return {
		// DB repos: bind with DbWriteCtx to extract read + write methods
		task: bindCtx(raw.task, dbCtx),
		taskTemplate: bindCtx(raw.taskTemplate, dbCtx),
		project: bindCtx(raw.project, dbCtx),
		workspace: bindCtx(raw.workspace, dbCtx),
		workspaceRepo: bindCtx(raw.workspaceRepo, dbCtx),
		session: bindCtx(raw.session, dbCtx),
		executionProcess: bindCtx(raw.executionProcess, dbCtx),
		executionProcessLogs: bindCtx(raw.executionProcessLogs, dbCtx),
		codingAgentTurn: bindCtx(raw.codingAgentTurn, dbCtx),
		tool: bindCtx(raw.tool, dbCtx),
		variant: bindCtx(raw.variant, dbCtx),
		approval: bindCtx(raw.approval, dbCtx),
		// External repos: DbWrite extracts nothing (ServiceCtx methods excluded)
		git: bindCtx(raw.git, dbCtx),
		worktree: bindCtx(raw.worktree, dbCtx),
		executor: bindCtx(raw.executor, dbCtx),
		messageQueue: bindCtx(raw.messageQueue, dbCtx),
		agentConfig: bindCtx(raw.agentConfig, dbCtx),
		workspaceConfig: bindCtx(raw.workspaceConfig, dbCtx),
		draft: bindCtx(raw.draft, dbCtx),
		permissionStore: bindCtx(raw.permissionStore, dbCtx),
		approvalStore: bindCtx(raw.approvalStore, dbCtx),
		logStoreManager: bindCtx(raw.logStoreManager, dbCtx),
		devServer: bindCtx(raw.devServer, dbCtx),
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

				// pre (outside transaction)
				let state: unknown = await (def.pre?.(preCtx) ?? {});
				if (isFail(state)) return { ok: false, error: state };

				// read → process → write (transaction scope depends on steps)
				if (def.write) {
					state = await ctx.db.transaction(async (tx) => {
						return executeDbSteps(
							ctx,
							def,
							processCtx,
							createDbWriteCtx(tx),
							state,
						);
					});
				} else if (def.read) {
					state = await ctx.db.readTransaction(async (tx) => {
						return executeDbSteps(
							ctx,
							def,
							processCtx,
							createDbReadCtx(tx),
							state,
						);
					});
				} else {
					state = await (def.process?.(processCtx, state as Unfail<TRead>) ??
						state);
				}
				if (isFail(state)) return { ok: false, error: state };

				// post (outside transaction, full access)
				if (def.post) {
					const postCtx: PostContext = {
						now: ctx.now,
						logger: ctx.logger,
						repos: ctx.repos,
					};
					state = await def.post(postCtx, state as Unfail<TWrite>);
				}
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

function executeDbSteps<TPre, TRead, TProcess, TWrite, TPost, TResult>(
	ctx: Context,
	def: UsecaseDefinition<TPre, TRead, TProcess, TWrite, TPost, TResult>,
	processCtx: ProcessContext,
	dbCtx: DbReadCtx | DbWriteCtx,
	state: unknown,
): Promise<unknown> {
	const readRepos = bindReadRepos(ctx.rawRepos, dbCtx);
	const readCtx: ReadContext = {
		now: ctx.now,
		logger: ctx.logger,
		repos: readRepos,
	};

	return (async () => {
		let s: unknown = await (def.read?.(readCtx, state as Unfail<TPre>) ??
			state);
		if (isFail(s)) return s;

		s = await (def.process?.(processCtx, s as Unfail<TRead>) ?? s);
		if (isFail(s)) return s;

		if (def.write) {
			const writeRepos = bindWriteRepos(ctx.rawRepos, dbCtx as DbWriteCtx);
			const writeCtx: WriteContext = {
				now: ctx.now,
				logger: ctx.logger,
				repos: writeRepos,
			};
			s = await def.write(writeCtx, s as Unfail<TProcess>);
		}
		return s;
	})();
}
