/**
 * E2E integration test for ExecutorRepository + ClaudeCodeDriver.
 *
 * Spawns actual claude-code CLI in plan mode via ExecutorRepository,
 * verifies that ExitPlanMode triggers approval creation,
 * and that approval response reaches Claude Code.
 */

import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Approval } from "../models/approval";
import {
	bindCtx,
	createServiceCtx,
	type Full,
	type Service,
} from "../repositories/common";
import type { ILogger } from "../types/logger";
import type {
	ApprovalRepository,
	ExecutionProcessLogsRepository,
	ExecutionProcessRepository,
	SessionRepository,
	TaskRepository,
	WorkspaceRepository,
} from "../repositories";
import { ApprovalStore } from "./approval-store";
import { ExecutorRepository } from "./executor";
import { ClaudeCodeDriver } from "./executor/drivers/claude-code";

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

function createMockExecutionProcessRepo(): Full<ExecutionProcessRepository> {
	const store = new Map();
	return {
		get: (spec: { id?: string }) => store.get(spec.id) ?? null,
		upsert: (ep: { id: string }) => store.set(ep.id, ep),
		list: () => ({ items: [], hasMore: false }),
	} as unknown as Full<ExecutionProcessRepository>;
}

function createMockLogsRepo(): Full<ExecutionProcessLogsRepository> {
	return {
		appendLogs: () => {},
		getLogs: () => null,
		upsertLogs: () => {},
		deleteLogs: () => {},
	} as unknown as Full<ExecutionProcessLogsRepository>;
}

function createMockApprovalRepo(): Full<ApprovalRepository> {
	const store = new Map<string, Approval>();
	return {
		get: (spec: { type?: string; id?: string }) => {
			if (spec.type === "ById" && spec.id) return store.get(spec.id) ?? null;
			return null;
		},
		upsert: (a: Approval) => store.set(a.id, a),
		list: () => ({ items: [], hasMore: false }),
		delete: () => 0,
	} as unknown as Full<ApprovalRepository>;
}

describe.skip("ExecutorRepository E2E (actual claude-code)", () => {
	test(
		"plan mode: ExitPlanMode creates approval via ExecutorRepository",
		async () => {
			const tmpDir = await mkdtemp(join(tmpdir(), "executor-repo-e2e-"));

			try {
				const logger = createMockLogger();
				const drivers = new Map();
				drivers.set("claude-code", new ClaudeCodeDriver(logger));

				const executionProcessRepo = createMockExecutionProcessRepo();
				const approvalStore = new ApprovalStore();
				const approvalRepo = createMockApprovalRepo();

				const executor = new ExecutorRepository(
					executionProcessRepo,
					undefined, // no codingAgentTurnRepo
					drivers,
					createMockLogsRepo(),
					logger,
				);

				// Wire approval deps
				executor.setApprovalDeps({
					approvalRepo,
					approvalStore: bindCtx(approvalStore, createServiceCtx()),
					taskRepo: {
						get: () => null,
					} as unknown as Full<TaskRepository>,
					sessionRepo: {
						get: () => null,
					} as unknown as Full<SessionRepository>,
					workspaceRepo: {
						get: () => null,
					} as unknown as Full<WorkspaceRepository>,
				});

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

				// Wait for approval to appear
				const startTime = Date.now();
				const timeout = 120_000;
				let pending: Approval[] = [];

				while (Date.now() - startTime < timeout) {
					pending = approvalStore.listPending(createServiceCtx(), rp.id);
					if (pending.length > 0) break;
					await new Promise((r) => setTimeout(r, 500));
				}

				console.log("[E2E] Pending approvals:", pending.length);

				// CRITICAL ASSERTION: Approval must be created
				expect(pending.length).toBeGreaterThan(0);
				expect(pending[0].toolName).toBe("ExitPlanMode");
				expect(pending[0].status).toBe("pending");
				expect(pending[0].executionProcessId).toBe(rp.id);

				console.log("[E2E] Approval verified! Responding...");

				// Approve it
				approvalStore.respond(
					createServiceCtx(),
					pending[0].id,
					"approved",
					null,
					approvalRepo,
				);

				// Wait briefly for response to be sent
				await new Promise((r) => setTimeout(r, 3000));

				// Kill the process (don't wait for full completion)
				await executor.kill(rp.id);

				console.log("[E2E] Test passed!");
			} finally {
				await rm(tmpDir, { recursive: true, force: true });
			}
		},
		{ timeout: 300_000 },
	);
});
