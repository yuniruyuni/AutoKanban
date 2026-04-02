import { describe, expect, test } from "bun:test";
import { createMockLogger } from "../../../../../test/helpers/logger";
import { ProtocolLogCollector } from "./protocol-log-collector";

describe("ProtocolLogCollector buffering", () => {
	test("should process JSON even if not followed by a newline", async () => {
		const logger = createMockLogger();
		const collector = new ProtocolLogCollector(logger);
		let idleCalled = false;
		collector.onIdle(() => {
			idleCalled = true;
		});

		// Mock streams
		const stdout = new ReadableStream({
			start(controller) {
				// Send a JSON without a newline
				const json = JSON.stringify({ type: "result", is_error: false });
				controller.enqueue(new TextEncoder().encode(json));
				controller.close();
			},
		});
		const stderr = new ReadableStream({
			start(controller) {
				controller.close();
			},
		});

		// Start collecting
		collector.collect("test-process", stdout, stderr);

		// Wait a bit for processing
		await new Promise((resolve) => setTimeout(resolve, 100));

		// REPRODUCTION POINT:
		// Currently this will FAIL because it waits for '\n' to process the line.
		expect(idleCalled).toBe(true);
	});
});
