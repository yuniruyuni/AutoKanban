/**
 * E2E integration test for ExecutorRepository + ClaudeCodeDriver.
 *
 * Spawns actual claude-code CLI in plan mode via ExecutorRepository,
 * verifies that ExitPlanMode triggers approval request event,
 * and that approval response reaches Claude Code.
 */

import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ILogger } from "../../../infra/logger/types";
import { createServiceCtx } from "../../common";
import { ExecutorRepository } from "..";
import { ClaudeCodeDriver } from "../drivers/claude-code";

function createMockLogger(): ILogger {
	const noop = () => {};
	return {
		info: (...args: unknown[]) => console.log("[INFO]", ...args),
		error: console.error,
		warn: console.warn,
		debug: noop,
		child: (prefix: string) => {
			const child = createMockLogger();
			child.info = (...args: unknown[]) =>
				console.log(`[INFO:${prefix}]`, ...args);
			return child;
		},
	} as unknown as ILogger;
}

describe.skip("ExecutorRepository E2E (actual claude-code)", () => {
	test(
		"plan mode: ExitPlanMode triggers approval request event",
		async () => {
			const tmpDir = await mkdtemp(join(tmpdir(), "executor-repo-e2e-"));

			try {
				const logger = createMockLogger();
				const drivers = new Map();
				drivers.set("claude-code", new ClaudeCodeDriver(logger));

				const approvalRequests: Array<{
					processId: string;
					request: unknown;
				}> = [];

				const mockCallback = {
					onProcessComplete: async () => {},
					onProcessIdle: async () => {},
					onApprovalRequest: async (processId: string, request: unknown) => {
						approvalRequests.push({ processId, request });
					},
					onLogData: async () => {},
					onSessionInfo: async () => {},
					onSummary: async () => {},
				};

				const executor = new ExecutorRepository(drivers, logger, mockCallback);

				// Start protocol in plan mode
				const rp = await executor.startProtocol(createServiceCtx(), {
					sessionId: "test-session-1",
					runReason: "codingagent",
					workingDir: tmpDir,
					prompt:
						'Create a file called hello.txt with "hello". Very simple task.',
					permissionMode: "plan",
				});

				console.log("[E2E] Process started:", rp.id);

				// Wait for approval request to appear
				const startTime = Date.now();
				const timeout = 120_000;

				while (Date.now() - startTime < timeout) {
					if (approvalRequests.length > 0) break;
					await new Promise((r) => setTimeout(r, 500));
				}

				console.log("[E2E] Approval requests:", approvalRequests.length);

				// CRITICAL ASSERTION: Approval request must be emitted
				expect(approvalRequests.length).toBeGreaterThan(0);
				expect(approvalRequests[0].processId).toBe(rp.id);

				console.log("[E2E] Approval request verified!");

				// Kill the process (don't wait for full completion)
				await executor.kill(createServiceCtx(), rp.id);

				console.log("[E2E] Test passed!");
			} finally {
				await rm(tmpDir, { recursive: true, force: true });
			}
		},
		{ timeout: 300_000 },
	);
});
