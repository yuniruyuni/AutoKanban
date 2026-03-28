import { describe, expect, test } from "bun:test";
import { createTestExecutionProcess } from "../../../test/factories";
import { createMockContext } from "../../../test/helpers/context";
import { stopExecution } from "./stop-execution";

describe("stopExecution", () => {
	test("stops a running execution process", async () => {
		const process = createTestExecutionProcess({ status: "running" });

		let stopCalled = false;
		let stoppedProcessId: string | undefined;

		const ctx = createMockContext({
			executionProcess: {
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

	test("returns NOT_FOUND when execution process does not exist", async () => {
		const ctx = createMockContext({
			executionProcess: {
				get: () => null,
			} as never,
		});

		const result = await stopExecution({
			executionProcessId: "non-existent",
		}).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
			expect(result.error.message).toContain("Execution process not found");
		}
	});

	test("stops an awaiting_approval execution process", async () => {
		const process = createTestExecutionProcess({ status: "awaiting_approval" });

		let stopCalled = false;
		const ctx = createMockContext({
			executionProcess: {
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

	test("returns INVALID_STATE when execution process is completed", async () => {
		const completedProcess = createTestExecutionProcess({
			status: "completed",
		});

		const ctx = createMockContext({
			executionProcess: {
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

	test("returns INVALID_STATE when execution process has failed", async () => {
		const failedProcess = createTestExecutionProcess({ status: "failed" });

		const ctx = createMockContext({
			executionProcess: {
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

	test("returns INVALID_STATE when execution process was killed", async () => {
		const killedProcess = createTestExecutionProcess({ status: "killed" });

		const ctx = createMockContext({
			executionProcess: {
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
		const process = createTestExecutionProcess({ status: "running" });

		const ctx = createMockContext({
			executionProcess: {
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
