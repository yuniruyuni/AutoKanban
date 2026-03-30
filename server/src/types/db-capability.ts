import type { PgDatabase } from "../db/pg-client";

// ============================================
// DB Capability Markers
// ============================================

declare const _dbRead: unique symbol;
declare const _dbWrite: unique symbol;

export interface DbReadCtx {
	readonly [_dbRead]: true;
	readonly db: PgDatabase;
}

export interface DbWriteCtx extends DbReadCtx {
	readonly [_dbWrite]: true;
}

export function createDbReadCtx(db: PgDatabase): DbReadCtx {
	return { db } as DbReadCtx;
}

export function createDbWriteCtx(db: PgDatabase): DbWriteCtx {
	return { db } as DbWriteCtx;
}

// ============================================
// Type Utilities
// ============================================

/**
 * Extract methods whose first parameter matches Marker, stripping that parameter.
 * Due to function contravariance:
 * - ExtractMethods<Def, DbReadCtx>  → read methods only
 * - ExtractMethods<Def, DbWriteCtx> → all methods (read + write)
 */
export type ExtractMethods<T, Marker> = {
	[K in keyof T as T[K] extends (m: Marker, ...args: infer _A) => infer _R
		? K
		: never]: T[K] extends (m: Marker, ...args: infer A) => infer R
		? (...args: A) => R
		: never;
};

/** Read-only methods (first arg: DbReadCtx) */
export type ReadMethods<T> = ExtractMethods<T, DbReadCtx>;

/** All DB methods with markers stripped (first arg: DbWriteCtx matches both) */
export type StripMarkers<T> = ExtractMethods<T, DbWriteCtx>;

// ============================================
// Binding (Proxy-based ctx injection)
// ============================================

/**
 * Create a proxy that auto-injects ctx as the first argument to all methods.
 * This allows usecases to call `repos.task.get(spec)` without passing ctx.
 */
export function bindDbCtx<T extends object, Ctx extends DbReadCtx>(
	repo: T,
	ctx: Ctx,
): ExtractMethods<T, Ctx> {
	return new Proxy(repo, {
		get(target, prop, receiver) {
			const value = Reflect.get(target, prop, receiver);
			if (typeof value === "function") {
				return (...args: unknown[]) => value.call(target, ctx, ...args);
			}
			return value;
		},
	}) as ExtractMethods<T, Ctx>;
}
