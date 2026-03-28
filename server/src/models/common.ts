// ============================================
// Fail type for error handling
// ============================================

export const FAIL_BRAND = Symbol.for("auto-kanban.Fail");

export interface Fail {
	readonly [FAIL_BRAND]: true;
	readonly code: string;
	readonly message: string;
	readonly details?: Record<string, unknown>;
}

export function fail(
	code: string,
	message: string,
	details?: Record<string, unknown>,
): Fail {
	return {
		[FAIL_BRAND]: true,
		code,
		message,
		details,
	};
}

export function isFail(value: unknown): value is Fail {
	return typeof value === "object" && value !== null && FAIL_BRAND in value;
}

export type Unfail<T> = T extends Fail ? never : T;

// ============================================
// Specification Pattern
// ============================================

export interface CompMethods<T> {
	and(other: Comp<T>): Comp<T>;
	or(other: Comp<T>): Comp<T>;
	not(): Comp<T>;
}

export type Comp<T> =
	| (T & CompMethods<T>)
	| ({ type: "and"; children: Comp<T>[] } & CompMethods<T>)
	| ({ type: "or"; children: Comp<T>[] } & CompMethods<T>)
	| ({ type: "not"; child: Comp<T> } & CompMethods<T>);

function addCompMethods<T>(obj: T): T & CompMethods<T> {
	const result = obj as T & CompMethods<T>;
	result.and = function (other: Comp<T>): Comp<T> {
		return addCompMethods({
			type: "and" as const,
			children: [this as Comp<T>, other],
		});
	};
	result.or = function (other: Comp<T>): Comp<T> {
		return addCompMethods({
			type: "or" as const,
			children: [this as Comp<T>, other],
		});
	};
	result.not = function (): Comp<T> {
		return addCompMethods({ type: "not" as const, child: this as Comp<T> });
	};
	return result;
}

export const and = <T>(...children: Comp<T>[]): Comp<T> =>
	addCompMethods({ type: "and" as const, children });

export const or = <T>(...children: Comp<T>[]): Comp<T> =>
	addCompMethods({ type: "or" as const, children });

export const not = <T>(child: Comp<T>): Comp<T> =>
	addCompMethods({ type: "not" as const, child });

export function isCompLogical<T>(
	value: Comp<T>,
): value is Exclude<Comp<T>, T & CompMethods<T>> {
	return (
		typeof value === "object" &&
		value !== null &&
		"type" in value &&
		(value.type === "and" || value.type === "or" || value.type === "not")
	);
}

// ============================================
// defineSpecs helper
// ============================================

type SpecsOfRaw<T extends Record<string, (...args: never[]) => object>> = {
	[K in keyof T & string]: ReturnType<T[K]> & { type: K };
}[keyof T & string];

export function defineSpecs<
	T extends Record<string, (...args: never[]) => object>,
>(
	specs: T,
): {
	[K in keyof T & string]: (...args: Parameters<T[K]>) => Comp<SpecsOfRaw<T>>;
} {
	const result = {} as Record<string, unknown>;
	for (const key of Object.keys(specs)) {
		result[key] = (...args: unknown[]) =>
			addCompMethods({
				type: key,
				...(specs[key] as (...args: unknown[]) => object)(...args),
			});
	}
	return result as {
		[K in keyof T & string]: (...args: Parameters<T[K]>) => Comp<SpecsOfRaw<T>>;
	};
}

export type SpecsOf<T> = {
	[K in keyof T]: T[K] extends (...args: never[]) => infer R
		? R extends Comp<infer U>
			? U
			: never
		: never;
}[keyof T];

// ============================================
// Pagination
// ============================================

export interface Cursor<T extends string> {
	limit: number;
	after?: Record<T, string>;
	sort?: Sort<T>;
}

export interface Sort<T extends string> {
	keys: readonly T[];
	order: "asc" | "desc";
}

export interface Page<T> {
	items: T[];
	hasMore: boolean;
	nextCursor?: Record<string, string>;
}

// ============================================
// ID generation
// ============================================

export function generateId(): string {
	return crypto.randomUUID();
}

// ============================================
// Draft (in-memory model)
// ============================================

export interface Draft {
	sessionId: string;
	text: string;
	savedAt: Date;
}

// ============================================
// PendingPermission (in-memory model)
// ============================================

export interface PendingPermission {
	requestId: string;
	processId: string;
	sessionId: string;
	toolName: string;
	toolInput: Record<string, unknown>;
	requestedAt: Date;
	timeoutMs: number;
}

// ============================================
// Log types (in-memory model)
// ============================================

export interface LogEntry {
	timestamp: Date;
	source: "stdout" | "stderr";
	data: string;
}

export interface LogStoreSubscription {
	/**
	 * Async generator that yields all history first, then live updates.
	 */
	stream: AsyncGenerator<LogEntry, void, unknown>;
	/**
	 * Unsubscribe from live updates.
	 */
	unsubscribe: () => void;
}
