/**
 * E2E integration test for ClaudeCodeDriver.
 *
 * Spawns actual claude-code CLI in plan mode,
 * sends a prompt that triggers ExitPlanMode,
 * and verifies the approval flow works end-to-end.
 */

import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ILogger } from "../../../../infra/logger/types";
import type { DriverApprovalRequest } from "../../orchestrator/driver-approval-request";
import { ClaudeCodeDriver } from "./claude-code-driver";

function createMockLogger(): ILogger {
	const noop = () => {};
	return {
		info: noop,
		error: console.error,
		warn: console.warn,
		debug: noop,
		child: () => createMockLogger(),
	} as unknown as ILogger;
}

describe.skip("ClaudeCodeDriver E2E (actual claude-code)", () => {
	test(
		"plan mode: ExitPlanMode triggers onApprovalRequest callback",
		async () => {
			const tmpDir = await mkdtemp(join(tmpdir(), "claude-driver-e2e-"));

			try {
				const driver = new ClaudeCodeDriver(createMockLogger());

				const process = driver.spawn({
					workingDir: tmpDir,
					permissionMode: "plan",
				});

				// Track callback events
				const events: {
					approvalRequests: DriverApprovalRequest[];
					idles: string[];
					hookErrors: Error[];
				} = {
					approvalRequests: [],
					idles: [],
					hookErrors: [],
				};

				const processId = "test-e2e-plan";

				await driver.initialize(process, processId, {
					onIdle: (pid) => {
						events.idles.push(pid);
					},
					onApprovalRequest: (pid, request) => {
						console.log(
							"[E2E] onApprovalRequest fired!",
							pid,
							request.toolName,
						);
						events.approvalRequests.push(request);
					},
					onSessionInfo: () => {},
					onSummary: () => {},
					onLogData: () => {},
				});

				// Send a simple prompt that will trigger plan mode → ExitPlanMode
				await driver.sendMessage(
					process,
					'Create a file called hello.txt with the content "hello world". This is a very simple task - just create the file.',
				);

				// Wait for ExitPlanMode to be called (up to 120 seconds)
				const startTime = Date.now();
				const timeout = 120_000;
				while (
					events.approvalRequests.length === 0 &&
					Date.now() - startTime < timeout
				) {
					await new Promise((r) => setTimeout(r, 500));
				}

				// Verify the approval request was received
				console.log(
					"[E2E] Approval requests received:",
					events.approvalRequests.length,
				);
				expect(events.approvalRequests.length).toBeGreaterThan(0);

				const request = events.approvalRequests[0];
				expect(request.toolName).toBe("ExitPlanMode");
				expect(request.protocolContext).toBeDefined();

				// Now respond with approval
				await driver.respondToApproval(process, request, true);
				console.log("[E2E] Approval response sent");

				// Wait for process to complete (or timeout)
				const result = await Promise.race([
					driver.wait(process),
					new Promise<{ exitCode: number; killed: boolean }>((r) =>
						setTimeout(() => r({ exitCode: -1, killed: true }), 60_000),
					),
				]);

				if (result.exitCode === -1) {
					// Timed out waiting for completion — kill the process
					driver.kill(process);
				}

				console.log("[E2E] Process exited with code:", result.exitCode);
			} finally {
				await rm(tmpDir, { recursive: true, force: true });
			}
		},
		{ timeout: 300_000 },
	);
});
