import { type Fail, fail, isFail, type Unfail } from "../models/common";
import { bindRepos } from "../repositories";
import {
	createDbReadCtx,
	createDbWriteCtx,
	type DbReadCtx,
	type DbWriteCtx,
} from "../repositories/common";
import type {
	Context,
	PostContext,
	PreContext,
	ProcessContext,
	ReadContext,
	WriteContext,
} from "./context";

// Re-export context types for convenience
export type {
	Context,
	PostContext,
	PreContext,
	ProcessContext,
	ReadContext,
	WriteContext,
} from "./context";

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
	const readCtx: ReadContext = {
		now: ctx.now,
		logger: ctx.logger,
		repos: bindRepos(ctx.rawRepos, dbCtx),
	};

	return (async () => {
		let s: unknown = await (def.read?.(readCtx, state as Unfail<TPre>) ??
			state);
		if (isFail(s)) return s;

		s = await (def.process?.(processCtx, s as Unfail<TRead>) ?? s);
		if (isFail(s)) return s;

		if (def.write) {
			const writeCtx: WriteContext = {
				now: ctx.now,
				logger: ctx.logger,
				repos: bindRepos(ctx.rawRepos, dbCtx as DbWriteCtx),
			};
			s = await def.write(writeCtx, s as Unfail<TProcess>);
		}
		return s;
	})();
}
