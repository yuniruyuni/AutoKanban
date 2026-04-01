import { describe, expect, test } from "bun:test";
import { createTestCodingAgentProcess } from "../../../test/factories";
import { createMockContext } from "../../../test/helpers/context";
import { stopExecution } from "./stop-execution";

describe("stopExecution", () => {
	test("stops a running coding agent process", async () => {
		const process = createTestCodingAgentProcess({ status: "running" });

		let stopCalled = false;
		let stoppedProcessId: string | undefined;

		const ctx = createMockContext({
			codingAgentProcess: {
				get: () => process,
			} as never,
			executor: {
				stop: async (id: string) => {
					stopCalled = true;
					stoppedProcessId = id;
					return true;
				},
			} as never,
		});

		const result = await stopExecution({
			executionProcessId: process.id,
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.stopped).toBe(true);
			expect(result.value.executionProcessId).toBe(process.id);
		}
		expect(stopCalled).toBe(true);
		expect(stoppedProcessId).toBe(process.id);
	});

	test("returns NOT_FOUND when coding agent process does not exist", async () => {
		const ctx = createMockContext({
			codingAgentProcess: {
				get: () => null,
			} as never,
		});

		const result = await stopExecution({
			executionProcessId: "non-existent",
		}).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
			expect(result.error.message).toContain("Coding agent process not found");
		}
	});

	test("stops an awaiting_approval coding agent process", async () => {
		const process = createTestCodingAgentProcess({
			status: "awaiting_approval",
		});

		let stopCalled = false;
		const ctx = createMockContext({
			codingAgentProcess: {
				get: () => process,
			} as never,
			executor: {
				stop: async () => {
					stopCalled = true;
					return true;
				},
			} as never,
		});

		const result = await stopExecution({
			executionProcessId: process.id,
		}).run(ctx);

		expect(result.ok).toBe(true);
		expect(stopCalled).toBe(true);
	});

	test("returns INVALID_STATE when coding agent process is completed", async () => {
		const completedProcess = createTestCodingAgentProcess({
			status: "completed",
		});

		const ctx = createMockContext({
			codingAgentProcess: {
				get: () => completedProcess,
			} as never,
		});

		const result = await stopExecution({
			executionProcessId: completedProcess.id,
		}).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("INVALID_STATE");
			expect(result.error.message).toContain("not active");
		}
	});

	test("returns INVALID_STATE when coding agent process has failed", async () => {
		const failedProcess = createTestCodingAgentProcess({ status: "failed" });

		const ctx = createMockContext({
			codingAgentProcess: {
				get: () => failedProcess,
			} as never,
		});

		const result = await stopExecution({
			executionProcessId: failedProcess.id,
		}).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("INVALID_STATE");
		}
	});

	test("returns INVALID_STATE when coding agent process was killed", async () => {
		const killedProcess = createTestCodingAgentProcess({ status: "killed" });

		const ctx = createMockContext({
			codingAgentProcess: {
				get: () => killedProcess,
			} as never,
		});

		const result = await stopExecution({
			executionProcessId: killedProcess.id,
		}).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("INVALID_STATE");
		}
	});

	test("returns stopped=false when executor.stop fails", async () => {
		const process = createTestCodingAgentProcess({ status: "running" });

		const ctx = createMockContext({
			codingAgentProcess: {
				get: () => process,
			} as never,
			executor: {
				stop: async () => false,
			} as never,
		});

		const result = await stopExecution({
			executionProcessId: process.id,
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.stopped).toBe(false);
		}
	});
});
