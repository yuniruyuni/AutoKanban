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
