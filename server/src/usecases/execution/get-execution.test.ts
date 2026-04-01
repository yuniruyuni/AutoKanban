import { describe, expect, test } from "bun:test";
import { createTestCodingAgentProcess } from "../../../test/factories";
import { createMockContext } from "../../../test/helpers/context";
import { getExecution } from "./get-execution";

describe("getExecution", () => {
	test("returns coding agent process without logs by default", async () => {
		const process = createTestCodingAgentProcess({ status: "running" });

		const ctx = createMockContext({
			codingAgentProcess: {
				get: () => process,
			} as never,
			devServerProcess: {
				get: () => null,
			} as never,
			workspaceScriptProcess: {
				get: () => null,
			} as never,
		});

		const result = await getExecution({
			executionProcessId: process.id,
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.executionProcess.id).toBe(process.id);
			// logs is not included in result when includeLogs is not specified
			expect(result.value.logs).toBeFalsy();
		}
	});

	test("returns coding agent process with logs when includeLogs is true", async () => {
		const process = createTestCodingAgentProcess({ status: "running" });
		const logs = {
			codingAgentProcessId: process.id,
			logs: "Some log content here",
		};

		const ctx = createMockContext({
			codingAgentProcess: {
				get: () => process,
			} as never,
			codingAgentProcessLogs: {
				getLogs: (id: string) => (id === process.id ? logs : null),
			} as never,
			devServerProcess: {
				get: () => null,
			} as never,
			workspaceScriptProcess: {
				get: () => null,
			} as never,
		});

		const result = await getExecution({
			executionProcessId: process.id,
			includeLogs: true,
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.executionProcess.id).toBe(process.id);
			expect(result.value.logs).toBeDefined();
			expect(result.value.logs?.logs).toBe("Some log content here");
		}
	});

	test("returns NOT_FOUND when process does not exist in any table", async () => {
		const ctx = createMockContext({
			codingAgentProcess: {
				get: () => null,
			} as never,
			devServerProcess: {
				get: () => null,
			} as never,
			workspaceScriptProcess: {
				get: () => null,
			} as never,
		});

		const result = await getExecution({
			executionProcessId: "non-existent",
		}).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
			expect(result.error.message).toContain("Execution process not found");
		}
	});

	test("returns null logs when logs are not available", async () => {
		const process = createTestCodingAgentProcess({ status: "running" });

		const ctx = createMockContext({
			codingAgentProcess: {
				get: () => process,
			} as never,
			codingAgentProcessLogs: {
				getLogs: () => null,
			} as never,
			devServerProcess: {
				get: () => null,
			} as never,
			workspaceScriptProcess: {
				get: () => null,
			} as never,
		});

		const result = await getExecution({
			executionProcessId: process.id,
			includeLogs: true,
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.executionProcess.id).toBe(process.id);
			expect(result.value.logs).toBeNull();
		}
	});

	test("returns different statuses correctly", async () => {
		const statuses: Array<"running" | "completed" | "failed" | "killed"> = [
			"running",
			"completed",
			"failed",
			"killed",
		];

		for (const status of statuses) {
			const process = createTestCodingAgentProcess({ status });

			const ctx = createMockContext({
				codingAgentProcess: {
					get: () => process,
				} as never,
				devServerProcess: {
					get: () => null,
				} as never,
				workspaceScriptProcess: {
					get: () => null,
				} as never,
			});

			const result = await getExecution({
				executionProcessId: process.id,
			}).run(ctx);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.executionProcess.status).toBe(status);
			}
		}
	});
});
