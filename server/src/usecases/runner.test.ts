import { describe, expect, test } from "bun:test";
import { createMockLogger } from "../../test/helpers/logger";
import type { PgDatabase } from "../db/pg-client";
import { fail } from "../models/common";
import type { ILogStreamer } from "../presentation/log-streamer";
import type { Context } from "../types/context";
import { usecase } from "./runner";

const mockDb = {
	transaction: async <T>(fn: (tx: PgDatabase) => Promise<T>) =>
		fn({} as PgDatabase),
} as PgDatabase;

const mockCtx: Context = {
	now: new Date("2025-01-15T10:00:00.000Z"),
	logger: createMockLogger(),
	db: mockDb,
	repos: {} as Context["repos"],
	logStreamer: {} as ILogStreamer,
	createTransactionRepos: (repos) => repos,
};

// ============================================
// Step execution order
// ============================================

describe("usecase step execution order", () => {
	test("executes steps in order: pre → read → process → write → post", async () => {
		const order: string[] = [];

		const uc = usecase({
			pre: () => {
				order.push("pre");
				return {};
			},
			read: () => {
				order.push("read");
				return {};
			},
			process: () => {
				order.push("process");
				return {};
			},
			write: () => {
				order.push("write");
				return {};
			},
			post: () => {
				order.push("post");
				return {};
			},
		});

		await uc.run(mockCtx);
		expect(order).toEqual(["pre", "read", "process", "write", "post"]);
	});

	test("passes pre output to read", async () => {
		const uc = usecase({
			pre: () => ({ value: 42 }),
			read: (_ctx, state) => {
				expect(state).toEqual({ value: 42 });
				return state;
			},
		});

		const result = await uc.run(mockCtx);
		expect(result.ok).toBe(true);
	});

	test("passes read output to process", async () => {
		const uc = usecase({
			read: () => ({ data: "hello" }),
			process: (_ctx, state) => {
				expect(state).toEqual({ data: "hello" });
				return { transformed: true };
			},
		});

		const result = await uc.run(mockCtx);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toEqual({ transformed: true });
		}
	});

	test("passes process output to write", async () => {
		const uc = usecase({
			process: () => ({ processed: true }),
			write: (_ctx, state) => {
				expect(state).toEqual({ processed: true });
				return { written: true };
			},
		});

		const result = await uc.run(mockCtx);
		expect(result.ok).toBe(true);
	});

	test("passes write output to post", async () => {
		const uc = usecase({
			write: () => ({ written: true }),
			post: (_ctx, state) => {
				expect(state).toEqual({ written: true });
				return state;
			},
		});

		await uc.run(mockCtx);
	});
});

// ============================================
// Fail short-circuit
// ============================================

describe("usecase fail short-circuit", () => {
	test("pre fail skips all subsequent steps", async () => {
		const order: string[] = [];

		const uc = usecase({
			pre: () => {
				order.push("pre");
				return fail("ERR", "stop");
			},
			read: () => {
				order.push("read");
				return {};
			},
			process: () => {
				order.push("process");
				return {};
			},
			write: () => {
				order.push("write");
				return {};
			},
		});

		const result = await uc.run(mockCtx);
		expect(result.ok).toBe(false);
		expect(order).toEqual(["pre"]);
	});

	test("read fail skips process/write/post", async () => {
		const order: string[] = [];

		const uc = usecase({
			pre: () => {
				order.push("pre");
				return {};
			},
			read: () => {
				order.push("read");
				return fail("NOT_FOUND", "missing");
			},
			process: () => {
				order.push("process");
				return {};
			},
			write: () => {
				order.push("write");
				return {};
			},
		});

		const result = await uc.run(mockCtx);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
		}
		expect(order).toEqual(["pre", "read"]);
	});

	test("process fail skips write/post", async () => {
		const uc = usecase({
			read: () => ({}),
			process: () => fail("INVALID_TRANSITION", "cannot transition"),
			write: () => {
				throw new Error("should not reach");
			},
		});

		const result = await uc.run(mockCtx);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("INVALID_TRANSITION");
		}
	});

	test("write fail skips post", async () => {
		const order: string[] = [];

		const uc = usecase({
			write: () => {
				order.push("write");
				return fail("DB_ERROR", "write failed");
			},
			post: () => {
				order.push("post");
				return {};
			},
		});

		const result = await uc.run(mockCtx);
		expect(result.ok).toBe(false);
		expect(order).toEqual(["write"]);
	});

	test("post fail returns error", async () => {
		const uc = usecase({
			post: () => fail("INTERNAL", "post failed"),
		});

		const result = await uc.run(mockCtx);
		expect(result.ok).toBe(false);
	});
});

// ============================================
// Context restrictions
// ============================================

describe("usecase context restrictions", () => {
	test("pre receives {now, logger} only", async () => {
		const uc = usecase({
			pre: (ctx) => {
				expect(ctx.now).toBeInstanceOf(Date);
				expect(ctx.logger).toBeDefined();
				expect("repos" in ctx).toBe(false);
				return {};
			},
		});

		await uc.run(mockCtx);
	});

	test("read receives {now, logger, repos}", async () => {
		const uc = usecase({
			read: (ctx) => {
				expect(ctx.now).toBeInstanceOf(Date);
				expect(ctx.logger).toBeDefined();
				expect(ctx.repos).toBeDefined();
				return {};
			},
		});

		await uc.run(mockCtx);
	});

	test("process receives {now, logger} only (no repos)", async () => {
		const uc = usecase({
			process: (ctx) => {
				expect(ctx.now).toBeInstanceOf(Date);
				expect(ctx.logger).toBeDefined();
				expect("repos" in ctx).toBe(false);
				return {};
			},
		});

		await uc.run(mockCtx);
	});

	test("write receives {now, logger, repos}", async () => {
		const uc = usecase({
			write: (ctx) => {
				expect(ctx.now).toBeInstanceOf(Date);
				expect(ctx.logger).toBeDefined();
				expect(ctx.repos).toBeDefined();
				return {};
			},
		});

		await uc.run(mockCtx);
	});

	test("post receives {now, logger, repos}", async () => {
		const uc = usecase({
			post: (ctx) => {
				expect(ctx.now).toBeInstanceOf(Date);
				expect(ctx.logger).toBeDefined();
				expect(ctx.repos).toBeDefined();
				return {};
			},
		});

		await uc.run(mockCtx);
	});
});

// ============================================
// Result step
// ============================================

describe("usecase result step", () => {
	test("result transforms final value", async () => {
		const uc = usecase({
			write: () => ({ raw: "data" }),
			result: (state) => ({ transformed: state.raw.toUpperCase() }),
		});

		const result = await uc.run(mockCtx);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toEqual({ transformed: "DATA" });
		}
	});

	test("without result step, last step output is returned", async () => {
		const uc = usecase({
			write: () => ({ final: true }),
		});

		const result = await uc.run(mockCtx);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toEqual({ final: true });
		}
	});
});

// ============================================
// Exception handling
// ============================================

describe("usecase exception handling", () => {
	test("exception in step returns INTERNAL fail", async () => {
		const uc = usecase({
			read: () => {
				throw new Error("unexpected");
			},
		});

		const result = await uc.run(mockCtx);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("INTERNAL");
		}
	});

	test("exception message is generic", async () => {
		const uc = usecase({
			process: () => {
				throw new Error("secret error");
			},
		});

		const result = await uc.run(mockCtx);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toBe("An unexpected error occurred");
		}
	});
});

// ============================================
// Empty usecase
// ============================================

describe("usecase with no steps", () => {
	test("returns ok with empty object", async () => {
		const uc = usecase({});
		const result = await uc.run(mockCtx);
		expect(result.ok).toBe(true);
	});
});
