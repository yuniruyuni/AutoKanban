import type { PgDatabase } from "../db/pg-client";

// ============================================
// Capability Marker Types
// ============================================

declare const _dbRead: unique symbol;
declare const _dbWrite: unique symbol;
declare const _service: unique symbol;

export interface DbReadCtx {
	readonly [_dbRead]: true;
	readonly db: PgDatabase;
}

export interface DbWriteCtx extends DbReadCtx {
	readonly [_dbWrite]: true;
}

export interface ServiceCtx {
	readonly [_service]: true;
}

// ============================================
// Context Factories
// ============================================

export function createDbReadCtx(db: PgDatabase): DbReadCtx {
	return { db } as DbReadCtx;
}

export function createDbWriteCtx(db: PgDatabase): DbWriteCtx {
	return { db } as DbWriteCtx;
}

export function createServiceCtx(): ServiceCtx {
	return {} as ServiceCtx;
}

export function createFullCtx(db: PgDatabase): DbWriteCtx & ServiceCtx {
	return { db } as DbWriteCtx & ServiceCtx;
}

// ============================================
// Type-Level Functions
// ============================================

/**
 * Extract methods whose first parameter matches Marker, stripping that parameter.
 * Due to function contravariance:
 * - ExtractMethods<T, DbReadCtx>  → read methods only
 * - ExtractMethods<T, DbWriteCtx> → read + write methods
 * - ExtractMethods<T, ServiceCtx> → service methods only
 * - ExtractMethods<T, DbWriteCtx & ServiceCtx> → all methods
 */
type ExtractMethods<T, Marker> = {
	[K in keyof T as T[K] extends (m: Marker, ...args: infer _A) => infer _R
		? K
		: never]: T[K] extends (m: Marker, ...args: infer A) => infer R
		? (...args: A) => R
		: never;
};

/** DB read-only methods (get, list, count, find*) */
export type DbRead<T> = ExtractMethods<T, DbReadCtx>;

/** DB read + write methods (includes read due to DbWriteCtx extends DbReadCtx) */
export type DbWrite<T> = ExtractMethods<T, DbWriteCtx>;

/** External service methods */
export type Service<T> = ExtractMethods<T, ServiceCtx>;

/** All methods (DB read + write + service) */
export type Full<T> = ExtractMethods<T, DbWriteCtx & ServiceCtx>;

// ============================================
// Mapped types for Repos
// ============================================

/** Apply DbRead to all fields of T */
export type DbReadRepos<T> = { [K in keyof T]: DbRead<T[K]> };

/** Apply DbWrite to all fields of T */
export type DbWriteRepos<T> = { [K in keyof T]: DbWrite<T[K]> };

/** Apply Service to all fields of T */
export type ServiceRepos<T> = { [K in keyof T]: Service<T[K]> };

/** Apply Full to all fields of T (all methods accessible) */
export type FullRepos<T> = { [K in keyof T]: Full<T[K]> };

// ============================================
// Binding (Proxy-based ctx injection)
// ============================================

/**
 * Create a proxy that auto-injects ctx as the first argument to all methods.
 * Usecases call `repos.task.get(spec)` — the proxy prepends ctx automatically.
 */
export function bindCtx<T extends object, Ctx>(
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
