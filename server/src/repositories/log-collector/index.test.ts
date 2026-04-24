import { describe, expect, test } from "bun:test";
import { createMockLogger } from "../../../test/helpers/logger";
import { LogCollector } from "./index";

/**
 * Safety net: if the underlying logs repo rejects an append (for example a
 * foreign-key violation during the brief window between spawn and DB row
 * commit), the collector must not surface it as an unhandled promise
 * rejection. One such rejection previously brought down the server.
 */

function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
	const enc = new TextEncoder();
	return new ReadableStream<Uint8Array>({
		start(controller) {
			for (const c of chunks) controller.enqueue(enc.encode(c));
			controller.close();
		},
	});
}

function emptyStream(): ReadableStream<Uint8Array> {
	return new ReadableStream<Uint8Array>({
		start(controller) {
			controller.close();
		},
	});
}

describe("LogCollector.collect", () => {
	test("does not propagate appendLogs rejections as unhandled", async () => {
		const logger = createMockLogger();
		const rejectingRepo = {
			appendLogs: async () => {
				throw new Error("FK violation (simulated)");
			},
		} as never;

		// If the rejection were unhandled, the test runner would see an
		// unhandled-rejection diagnostic. We also assert the logger captures
		// the error so regressions are visible even if the runner doesn't.
		const collector = new LogCollector(rejectingRepo, logger);
		collector.collect("p1", streamFromChunks(["hello"]), emptyStream());

		// Give the microtask queue time for the write + catch to settle.
		await new Promise((r) => setTimeout(r, 50));

		expect(logger.hasError(/Failed to persist log chunk/)).toBe(true);
	});

	test("appendLogs still receives the framed chunk when the repo resolves", async () => {
		const calls: Array<{ processId: string; chunk: string }> = [];
		const repo = {
			appendLogs: async (processId: string, chunk: string) => {
				calls.push({ processId, chunk });
			},
		} as never;

		const collector = new LogCollector(repo, createMockLogger());
		collector.collect("p2", streamFromChunks(["hi"]), emptyStream());

		await new Promise((r) => setTimeout(r, 50));

		expect(calls.length).toBe(1);
		expect(calls[0].processId).toBe("p2");
		expect(calls[0].chunk).toMatch(/\[stdout\] hi\n$/);
	});
});
