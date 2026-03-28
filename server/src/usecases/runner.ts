import { type Fail, fail, isFail, type Unfail } from "../models/common";
import type {
	Context,
	PostContext,
	PreContext,
	ProcessContext,
	ReadContext,
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
				// Construct step-specific contexts
				const preCtx: PreContext = { now: ctx.now, logger: ctx.logger };
				const readCtx: ReadContext = {
					now: ctx.now,
					logger: ctx.logger,
					repos: ctx.repos,
				};
				const processCtx: ProcessContext = { now: ctx.now, logger: ctx.logger };
				const writeCtx: WriteContext = {
					now: ctx.now,
					logger: ctx.logger,
					repos: ctx.repos,
				};
				const postCtx: PostContext = {
					now: ctx.now,
					logger: ctx.logger,
					repos: ctx.repos,
				};

				// pre (outside transaction)
				let state: unknown = await (def.pre?.(preCtx) ?? {});
				if (isFail(state)) return { ok: false, error: state };

				// read → process → write (inside transaction)
				// Note: bun:sqlite transactions are synchronous, but our steps may be async
				// For simplicity, we run them sequentially here

				state = await (def.read?.(readCtx, state as Unfail<TPre>) ?? state);
				if (isFail(state)) return { ok: false, error: state };

				state = await (def.process?.(processCtx, state as Unfail<TRead>) ??
					state);
				if (isFail(state)) return { ok: false, error: state };

				state = await (def.write?.(writeCtx, state as Unfail<TProcess>) ??
					state);
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
