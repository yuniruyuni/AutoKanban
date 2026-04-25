import { describe, expect, test } from "bun:test";
import { createMockLogger } from "../../../test/helpers/logger";
import { type Fail, fail } from "../../models/common";
import type { SSEDeltaResult } from "../../models/sse";
import type { Context } from "../../usecases/context";
import type { Usecase } from "../../usecases/runner";
import {
	computeDeltaInterval,
	MAX_BACKOFF_MS,
	runDeltaLoop,
	type SSEWriter,
	STREAM_ERROR_THRESHOLD,
} from "./stream";

class FakeWriter implements SSEWriter {
	readonly events: { event: string; data: string }[] = [];
	async writeSSE(event: { event: string; data: string }): Promise<void> {
		this.events.push(event);
	}
}

function makeCtx() {
	const logger = createMockLogger();
	const ctx = {
		now: new Date(),
		logger,
		db: {} as Context["db"],
		rawRepos: {} as Context["rawRepos"],
		repos: {} as Context["repos"],
	};
	return { ctx, logger };
}

function ok<T>(value: T): Usecase<T> {
	return { run: async () => ({ ok: true, value }) };
}

function err<T>(error: Fail): Usecase<T> {
	return { run: async () => ({ ok: false, error }) };
}

describe("computeDeltaInterval", () => {
	test("returns base interval when no failures", () => {
		expect(computeDeltaInterval(500, 0)).toBe(500);
	});

	test("doubles interval with each consecutive failure", () => {
		expect(computeDeltaInterval(500, 1)).toBe(1000);
		expect(computeDeltaInterval(500, 2)).toBe(2000);
		expect(computeDeltaInterval(500, 3)).toBe(4000);
	});

	test("caps at MAX_BACKOFF_MS", () => {
		expect(computeDeltaInterval(500, 10)).toBe(MAX_BACKOFF_MS);
		expect(computeDeltaInterval(2000, 10)).toBe(MAX_BACKOFF_MS);
	});
});

describe("runDeltaLoop", () => {
	test("logs delta failure with route path, params, code, and message", async () => {
		const { ctx, logger } = makeCtx();
		const writer = new FakeWriter();
		const controller = new AbortController();

		await runDeltaLoop<{ id: string }, { offset: number }>({
			ctx,
			path: "/test/:id",
			params: { id: "abc" },
			initialState: { offset: 0 },
			delta: () => {
				controller.abort();
				return err<SSEDeltaResult<{ offset: number }>>(
					fail("INTERNAL", "boom"),
				);
			},
			baseInterval: 1,
			signal: controller.signal,
			writer,
		});

		const errorEntries = logger.entries.filter((e) => e.level === "error");
		expect(errorEntries).toHaveLength(1);
		expect(errorEntries[0]?.message).toBe("[sse] delta failed");
		expect(errorEntries[0]?.args[0]).toMatchObject({
			path: "/test/:id",
			params: { id: "abc" },
			code: "INTERNAL",
			message: "boom",
			consecutiveFailures: 1,
		});
	});

	test("emits stream-error after threshold consecutive failures", async () => {
		const { ctx } = makeCtx();
		const writer = new FakeWriter();
		const controller = new AbortController();
		let calls = 0;

		await runDeltaLoop<Record<string, never>, number>({
			ctx,
			path: "/test",
			params: {},
			initialState: 0,
			delta: () => {
				calls += 1;
				if (calls >= STREAM_ERROR_THRESHOLD) controller.abort();
				return err<SSEDeltaResult<number>>(fail("DB_ERROR", "transient"));
			},
			baseInterval: 1,
			signal: controller.signal,
			writer,
		});

		const streamErrors = writer.events.filter(
			(e) => e.event === "stream-error",
		);
		expect(streamErrors).toHaveLength(1);
		expect(JSON.parse(streamErrors[0]?.data ?? "{}")).toMatchObject({
			code: "DB_ERROR",
			message: "transient",
			consecutiveFailures: STREAM_ERROR_THRESHOLD,
		});
	});

	test("does not emit stream-error before threshold", async () => {
		const { ctx } = makeCtx();
		const writer = new FakeWriter();
		const controller = new AbortController();
		let calls = 0;

		await runDeltaLoop<Record<string, never>, number>({
			ctx,
			path: "/test",
			params: {},
			initialState: 0,
			delta: () => {
				calls += 1;
				if (calls >= STREAM_ERROR_THRESHOLD - 1) controller.abort();
				return err<SSEDeltaResult<number>>(fail("INTERNAL", "x"));
			},
			baseInterval: 1,
			signal: controller.signal,
			writer,
		});

		expect(
			writer.events.find((e) => e.event === "stream-error"),
		).toBeUndefined();
	});

	test("resets failure counter after a successful delta", async () => {
		const { ctx } = makeCtx();
		const writer = new FakeWriter();
		const controller = new AbortController();
		const sequence: ("fail" | "ok")[] = ["fail", "fail", "ok", "fail", "fail"];
		let i = 0;

		await runDeltaLoop<Record<string, never>, number>({
			ctx,
			path: "/test",
			params: {},
			initialState: 0,
			delta: () => {
				const action = sequence[i];
				i += 1;
				if (i >= sequence.length) controller.abort();
				if (action === "ok") {
					return ok<SSEDeltaResult<number>>({ events: [], state: i });
				}
				return err<SSEDeltaResult<number>>(fail("INTERNAL", "x"));
			},
			baseInterval: 1,
			signal: controller.signal,
			writer,
		});

		expect(
			writer.events.find((e) => e.event === "stream-error"),
		).toBeUndefined();
	});

	test("forwards delta events on success", async () => {
		const { ctx } = makeCtx();
		const writer = new FakeWriter();
		const controller = new AbortController();
		let called = false;

		await runDeltaLoop<Record<string, never>, number>({
			ctx,
			path: "/test",
			params: {},
			initialState: 0,
			delta: () => {
				if (called) {
					controller.abort();
					return ok<SSEDeltaResult<number>>({ events: [], state: 1 });
				}
				called = true;
				return ok<SSEDeltaResult<number>>({
					events: [{ type: "log", data: "hello" }],
					state: 1,
				});
			},
			baseInterval: 1,
			signal: controller.signal,
			writer,
		});

		const logEvents = writer.events.filter((e) => e.event === "log");
		expect(logEvents).toHaveLength(1);
		expect(JSON.parse(logEvents[0]?.data ?? "null")).toBe("hello");
	});

	test("uses exponential backoff between failed delta attempts", async () => {
		const { ctx } = makeCtx();
		const writer = new FakeWriter();
		const controller = new AbortController();
		const callTimes: number[] = [];
		const startedAt = Date.now();
		let calls = 0;

		await runDeltaLoop<Record<string, never>, number>({
			ctx,
			path: "/test",
			params: {},
			initialState: 0,
			delta: () => {
				callTimes.push(Date.now() - startedAt);
				calls += 1;
				if (calls >= 3) controller.abort();
				return err<SSEDeltaResult<number>>(fail("INTERNAL", "x"));
			},
			baseInterval: 20,
			signal: controller.signal,
			writer,
		});

		expect(callTimes).toHaveLength(3);
		const [t0 = 0, t1 = 0, t2 = 0] = callTimes;
		// 1st call ~= base, 2nd ~= base*2, 3rd ~= base*4 (cumulative).
		// Loose lower bounds to avoid timer jitter flakiness.
		expect(t1 - t0).toBeGreaterThanOrEqual(30);
		expect(t2 - t1).toBeGreaterThanOrEqual(60);
	});
});
