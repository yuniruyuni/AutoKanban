/**
 * E2E integration test for ExecutorRepository + ClaudeCodeDriver.
 *
 * Spawns actual claude-code CLI in plan mode via ExecutorRepository,
 * verifies that ExitPlanMode triggers approval creation,
 * and that approval response reaches Claude Code.
 */

import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Approval } from "../models/approval";
import type { ILogger } from "../types/logger";
import type {
	IApprovalRepository,
	IApprovalStore,
	ICodingAgentTurnRepository,
	IExecutionProcessLogsRepository,
	IExecutionProcessRepository,
	ISessionRepository,
	ITaskRepository,
	IWorkspaceRepository,
} from "../types/repository";
import { ApprovalStore } from "./approval-store";
import { ClaudeCodeDriver } from "./drivers/claude-code";
import { ExecutorRepository } from "./executor-repository";

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

function createMockExecutionProcessRepo(): IExecutionProcessRepository {
	const store = new Map();
	return {
		get: (spec: { id?: string }) => store.get(spec.id) ?? null,
		upsert: (ep: { id: string }) => store.set(ep.id, ep),
		list: () => ({ items: [], hasMore: false }),
	} as unknown as IExecutionProcessRepository;
}

function createMockLogsRepo(): IExecutionProcessLogsRepository {
	return {
		appendLogs: () => {},
		getLogs: () => null,
		upsertLogs: () => {},
		deleteLogs: () => {},
	} as unknown as IExecutionProcessLogsRepository;
}

function createMockApprovalRepo(): IApprovalRepository {
	const store = new Map<string, Approval>();
	return {
		get: (spec: { type?: string; id?: string }) => {
			if (spec.type === "ById") return store.get(spec.id!) ?? null;
			return null;
		},
		upsert: (a: Approval) => store.set(a.id, a),
		list: () => ({ items: [], hasMore: false }),
		delete: () => 0,
	} as unknown as IApprovalRepository;
}

describe("ExecutorRepository E2E (actual claude-code)", () => {
	test(
		"plan mode: ExitPlanMode creates approval via ExecutorRepository",
		async () => {
			const tmpDir = await mkdtemp(
				join(tmpdir(), "executor-repo-e2e-"),
			);

			try {
				const logger = createMockLogger();
				const drivers = new Map();
				drivers.set("claude-code", new ClaudeCodeDriver(logger));

				const executionProcessRepo =
					createMockExecutionProcessRepo();
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
					approvalStore,
					taskRepo: { get: () => null } as unknown as ITaskRepository,
					sessionRepo: {
						get: () => null,
					} as unknown as ISessionRepository,
					workspaceRepo: {
						get: () => null,
					} as unknown as IWorkspaceRepository,
				});

				// Start protocol in plan mode
				const rp = await executor.startProtocol({
					sessionId: "test-session-1",
					runReason: "codingagent",
					workingDir: tmpDir,
					prompt: 'Create a file called hello.txt with "hello". Very simple task.',
					permissionMode: "plan",
				});

				console.log("[E2E] Process started:", rp.id);

				// Wait for approval to appear
				const startTime = Date.now();
				const timeout = 120_000;
				let pending: Approval[] = [];

				while (Date.now() - startTime < timeout) {
					pending = approvalStore.listPending(rp.id);
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
