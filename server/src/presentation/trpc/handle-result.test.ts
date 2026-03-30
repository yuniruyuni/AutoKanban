import { describe, expect, test } from "bun:test";
import { TRPCError } from "@trpc/server";
import type { Fail } from "../../models/common";
import { fail } from "../../models/common";
import type { Result } from "../../usecases/runner";
import { handleResult } from "./handle-result";

// ============================================
// handleResult - success
// ============================================

describe("handleResult success", () => {
	test("returns value for ok result", () => {
		const result: Result<string, Fail> = { ok: true, value: "hello" };
		expect(handleResult(result)).toBe("hello");
	});

	test("returns complex value for ok result", () => {
		const value = { id: "1", name: "test" };
		const result: Result<typeof value, Fail> = { ok: true, value };
		expect(handleResult(result)).toEqual(value);
	});
});

// ============================================
// handleResult - fail code mapping
// ============================================

describe("handleResult fail code mapping", () => {
	test("NOT_FOUND maps to NOT_FOUND TRPCError", () => {
		const result: Result<never, Fail> = {
			ok: false,
			error: fail("NOT_FOUND", "Not found"),
		};
		expect(() => handleResult(result)).toThrow(TRPCError);
		try {
			handleResult(result);
		} catch (e) {
			expect((e as TRPCError).code).toBe("NOT_FOUND");
		}
	});

	test("INVALID_INPUT maps to BAD_REQUEST", () => {
		const result: Result<never, Fail> = {
			ok: false,
			error: fail("INVALID_INPUT", "Bad"),
		};
		try {
			handleResult(result);
		} catch (e) {
			expect((e as TRPCError).code).toBe("BAD_REQUEST");
		}
	});

	test("INVALID_TRANSITION maps to BAD_REQUEST", () => {
		const result: Result<never, Fail> = {
			ok: false,
			error: fail("INVALID_TRANSITION", "Cannot"),
		};
		try {
			handleResult(result);
		} catch (e) {
			expect((e as TRPCError).code).toBe("BAD_REQUEST");
		}
	});

	test("DUPLICATE maps to CONFLICT", () => {
		const result: Result<never, Fail> = {
			ok: false,
			error: fail("DUPLICATE", "Exists"),
		};
		try {
			handleResult(result);
		} catch (e) {
			expect((e as TRPCError).code).toBe("CONFLICT");
		}
	});

	test("INTERNAL maps to INTERNAL_SERVER_ERROR", () => {
		const result: Result<never, Fail> = {
			ok: false,
			error: fail("INTERNAL", "Error"),
		};
		try {
			handleResult(result);
		} catch (e) {
			expect((e as TRPCError).code).toBe("INTERNAL_SERVER_ERROR");
		}
	});

	test("unknown code maps to INTERNAL_SERVER_ERROR", () => {
		const result: Result<never, Fail> = {
			ok: false,
			error: fail("UNKNOWN_CODE", "Unknown"),
		};
		try {
			handleResult(result);
		} catch (e) {
			expect((e as TRPCError).code).toBe("INTERNAL_SERVER_ERROR");
		}
	});
});

// ============================================
// handleResult - error details
// ============================================

describe("handleResult error details", () => {
	test("preserves error message", () => {
		const result: Result<never, Fail> = {
			ok: false,
			error: fail("NOT_FOUND", "Task not found"),
		};
		try {
			handleResult(result);
		} catch (e) {
			expect((e as TRPCError).message).toBe("Task not found");
		}
	});

	test("preserves cause details", () => {
		const f = fail("NOT_FOUND", "Missing", { id: "123" });
		const result: Result<never, Fail> = { ok: false, error: f };
		try {
			handleResult(result);
		} catch (e) {
			const cause = (e as TRPCError).cause as {
				code?: string;
				details?: Record<string, unknown>;
			};
			// TRPCError wraps cause via getCauseFromUnknown, so we check the properties are preserved
			expect(cause.code).toBe("NOT_FOUND");
			expect(cause.details).toEqual({ id: "123" });
		}
	});

	test("DB_ERROR maps to INTERNAL_SERVER_ERROR", () => {
		const result: Result<never, Fail> = {
			ok: false,
			error: fail("DB_ERROR", "DB failed"),
		};
		try {
			handleResult(result);
		} catch (e) {
			expect((e as TRPCError).code).toBe("INTERNAL_SERVER_ERROR");
		}
	});
});
