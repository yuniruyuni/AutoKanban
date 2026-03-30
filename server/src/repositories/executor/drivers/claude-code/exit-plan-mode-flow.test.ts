/**
 * Integration test for the ExitPlanMode approval flow.
 *
 * Simulates the FULL end-to-end flow:
 *   Claude Code stdout  →  ProtocolLogCollector  →  ExecutorRepository callbacks
 *   →  ApprovalStore  →  getPendingApprovals (client query)
 *
 * This test reproduces the production scenario where:
 * 1. Hooks are registered (always, after the fix)
 * 2. Claude Code sends hookCallback (callback_id: "tool_approval")
 * 3. SDK responds with "ask"
 * 4. Claude Code sends canUseTool (tool_name: "ExitPlanMode")
 * 5. SDK creates approval → visible to client via listPending()
 */

import { describe, expect, test } from "bun:test";
import { Approval } from "../../../../models/approval";
import type { ClaudeControlRequestMessage } from "../../../../models/claude-protocol";
import { createServiceCtx, type Full } from "../../../common";
import type { ILogger } from "../../../../lib/logger/types";
import type {
	ApprovalRepository,
	ExecutionProcessLogsRepository,
} from "../../..";
import { ApprovalStore } from "../../../approval-store";
import type { ClaudeCodeProcess } from "./claude-code-executor";
import {
	AUTO_APPROVE_CALLBACK_ID,
	TOOL_APPROVAL_CALLBACK_ID,
} from "./claude-code-executor";
import { ProtocolLogCollector } from "./protocol-log-collector";

// ============================================
// Test helpers
// ============================================

function createMockLogger(): ILogger {
	const noop = () => {};
	return {
		info: noop,
		error: noop,
		warn: noop,
		debug: noop,
		child: () => createMockLogger(),
	} as unknown as ILogger;
}

function createMockLogsRepo(): Full<ExecutionProcessLogsRepository> {
	return {
		appendLogs: () => {},
		getLogs: () => "",
	} as unknown as Full<ExecutionProcessLogsRepository>;
}

function createMockApprovalRepo(): Full<ApprovalRepository> {
	const store = new Map<string, Approval>();
	return {
		get: (spec: Approval.Spec) => {
			if (spec.type === "ById") {
				return store.get(spec.id) ?? null;
			}
			return null;
		},
		upsert: (approval: Approval) => {
			store.set(approval.id, approval);
		},
		list: () => ({ items: [], hasMore: false }),
		delete: () => 0,
	} as unknown as Full<ApprovalRepository>;
}

function makeStream(lines: object[]): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	const data = `${lines.map((l) => JSON.stringify(l)).join("\n")}\n`;
	return new ReadableStream({
		start(controller) {
			controller.enqueue(encoder.encode(data));
			controller.close();
		},
	});
}

function emptyStream(): ReadableStream<Uint8Array> {
	return new ReadableStream({
		start(controller) {
			controller.close();
		},
	});
}

// ============================================
// Integration tests
// ============================================

describe("ExitPlanMode approval flow (integration)", () => {
	/**
	 * This test simulates what happens in production:
	 *
	 * 1. ProtocolLogCollector receives hookCallback + canUseTool from stdout
	 * 2. ExecutorRepository's callback wiring routes them correctly
	 * 3. ApprovalStore.createAndWait is called
	 * 4. Client calls listPending() → should see the approval
	 *
	 * If this test FAILS, it means the approval flow is broken.
	 */
	test("hookCallback + canUseTool flow creates approval visible via listPending", async () => {
		// Setup: real components
		const approvalStore = new ApprovalStore();
		const approvalRepo = createMockApprovalRepo();
		const collector = new ProtocolLogCollector(
			createMockLogsRepo(),
			undefined,
			createMockLogger(),
		);

		const processId = "test-process-1";

		// Track hook responses sent (simulating executor.sendHookResponse)
		const hookResponsesSent: Array<{
			processId: string;
			requestId: string;
			decision: string;
		}> = [];

		// Wire up callbacks exactly like ExecutorRepository does in its constructor

		// 1. hookCallback handler (from ExecutorRepository.handleHookCallback)
		// tool_approval → "ask" (forwards to can_use_tool for user approval)
		// AUTO_APPROVE → "allow" (immediately permits the tool)
		collector.onHookCallback((_procId, request) => {
			const callbackId = request.request.callback_id as string | undefined;
			const decision =
				callbackId === TOOL_APPROVAL_CALLBACK_ID ? "ask" : "allow";
			hookResponsesSent.push({
				processId: _procId,
				requestId: request.request_id,
				decision,
			});
		});

		// 2. approval request handler (from ExecutorRepository.handleApprovalRequest)
		collector.onApprovalRequest((_procId, request) => {
			const toolCallId =
				(request.request.tool_use_id as string) ?? request.request_id;
			const toolName = (request.request.tool_name as string) ?? "ExitPlanMode";

			const approval = Approval.create({
				executionProcessId: _procId,
				toolName,
				toolCallId,
			});

			// This is what handleApprovalRequest does: blocks until user responds
			approvalStore.createAndWait(createServiceCtx(), approval, approvalRepo);
			// Note: we don't await - in production it blocks, but we just need it
			// to store in pending Map (which happens synchronously in the Promise constructor)
		});

		// 3. auto-approve handler (from ExecutorRepository auto-approve callback)
		const autoApproved: ClaudeControlRequestMessage[] = [];
		collector.onAutoApprove((_procId, request) => {
			autoApproved.push(request);
		});

		// Simulate: Claude Code stdout sends hookCallback then canUseTool
		const stdout = makeStream([
			{
				type: "control_request",
				request_id: "hook-req-1",
				request: {
					subtype: "hookCallback",
					callback_id: "tool_approval",
				},
			},
			{
				type: "control_request",
				request_id: "can-use-tool-1",
				request: {
					subtype: "canUseTool",
					tool_name: "ExitPlanMode",
					tool_use_id: "tool-use-1",
				},
			},
		]);

		collector.collect(processId, stdout, emptyStream());

		// Wait for async stream processing
		await new Promise((r) => setTimeout(r, 100));

		// ============================================
		// Assertions: verify the full flow worked
		// ============================================

		// 1. hookCallback was received and "ask" was decided (forwards to can_use_tool)
		expect(hookResponsesSent).toHaveLength(1);
		expect(hookResponsesSent[0].decision).toBe("ask");
		expect(hookResponsesSent[0].requestId).toBe("hook-req-1");

		// 2. canUseTool triggered approval creation (not auto-approve)
		expect(autoApproved).toHaveLength(0);

		// 3. CRITICAL: Approval is visible via listPending
		//    This is what the client's getPendingApprovals query returns.
		//    If this fails, the UI will show FollowUpInput instead of PlanResponseInput.
		const pending = approvalStore.listPending(createServiceCtx(), processId);
		expect(pending).toHaveLength(1);
		expect(pending[0].toolName).toBe("ExitPlanMode");
		expect(pending[0].status).toBe("pending");
		expect(pending[0].executionProcessId).toBe(processId);
	});

	/**
	 * Test that AUTO_APPROVE hookCallback does NOT create an approval.
	 */
	test("AUTO_APPROVE hookCallback auto-approves without creating approval", async () => {
		const approvalStore = new ApprovalStore();
		const collector = new ProtocolLogCollector(
			createMockLogsRepo(),
			undefined,
			createMockLogger(),
		);

		const processId = "test-process-2";
		const hookDecisions: string[] = [];

		collector.onHookCallback((_procId, request) => {
			const callbackId = request.request.callback_id as string | undefined;
			if (callbackId === AUTO_APPROVE_CALLBACK_ID) {
				hookDecisions.push("allow");
			} else {
				hookDecisions.push("ask");
			}
		});

		collector.onApprovalRequest(() => {
			// Should NOT be called
			throw new Error("Approval request should not be triggered");
		});

		const stdout = makeStream([
			{
				type: "control_request",
				request_id: "hook-auto-1",
				request: {
					subtype: "hookCallback",
					callback_id: AUTO_APPROVE_CALLBACK_ID,
				},
			},
		]);

		collector.collect(processId, stdout, emptyStream());
		await new Promise((r) => setTimeout(r, 100));

		expect(hookDecisions).toEqual(["allow"]);
		expect(
			approvalStore.listPending(createServiceCtx(), processId),
		).toHaveLength(0);
	});

	/**
	 * Test that non-ExitPlanMode canUseTool gets auto-approved (no approval created).
	 */
	test("non-ExitPlanMode canUseTool is auto-approved", async () => {
		const approvalStore = new ApprovalStore();
		const collector = new ProtocolLogCollector(
			createMockLogsRepo(),
			undefined,
			createMockLogger(),
		);

		const processId = "test-process-3";
		const autoApproved: string[] = [];

		collector.onAutoApprove((_procId, request) => {
			autoApproved.push(request.request.tool_name as string);
		});

		collector.onApprovalRequest(() => {
			throw new Error("Should not create approval for non-ExitPlanMode");
		});

		const stdout = makeStream([
			{
				type: "control_request",
				request_id: "can-use-bash-1",
				request: {
					subtype: "canUseTool",
					tool_name: "Bash",
					tool_use_id: "tool-bash-1",
				},
			},
		]);

		collector.collect(processId, stdout, emptyStream());
		await new Promise((r) => setTimeout(r, 100));

		expect(autoApproved).toEqual(["Bash"]);
		expect(
			approvalStore.listPending(createServiceCtx(), processId),
		).toHaveLength(0);
	});

	/**
	 * Test the full approve/respond cycle.
	 * After approval is created, simulate user approving it.
	 */
	test("full cycle: create approval → user approves → promise resolves", async () => {
		const approvalStore = new ApprovalStore();
		const approvalRepo = createMockApprovalRepo();
		const collector = new ProtocolLogCollector(
			createMockLogsRepo(),
			undefined,
			createMockLogger(),
		);

		const processId = "test-process-4";
		let approvalResponse: { status: string; reason: string | null } | null =
			null;

		collector.onHookCallback(() => {
			// Just accept
		});

		collector.onApprovalRequest(async (_procId, request) => {
			const toolCallId =
				(request.request.tool_use_id as string) ?? request.request_id;
			const toolName = (request.request.tool_name as string) ?? "ExitPlanMode";

			const approval = Approval.create({
				executionProcessId: _procId,
				toolName,
				toolCallId,
			});

			// This blocks until user responds
			const response = await approvalStore.createAndWait(
				createServiceCtx(),
				approval,
				approvalRepo,
			);
			approvalResponse = response;
		});

		const stdout = makeStream([
			{
				type: "control_request",
				request_id: "hook-cycle-1",
				request: {
					subtype: "hookCallback",
					callback_id: "tool_approval",
				},
			},
			{
				type: "control_request",
				request_id: "can-use-cycle-1",
				request: {
					subtype: "canUseTool",
					tool_name: "ExitPlanMode",
					tool_use_id: "tool-cycle-1",
				},
			},
		]);

		collector.collect(processId, stdout, emptyStream());
		await new Promise((r) => setTimeout(r, 100));

		// Approval should be pending
		const pending = approvalStore.listPending(createServiceCtx(), processId);
		expect(pending).toHaveLength(1);

		// Simulate user approving
		const approvalId = pending[0].id;
		const success = await approvalStore.respond(
			createServiceCtx(),
			approvalId,
			"approved",
			null,
			approvalRepo,
		);
		expect(success).toBe(true);

		// Wait for promise resolution
		await new Promise((r) => setTimeout(r, 50));

		// Approval should no longer be pending
		expect(
			approvalStore.listPending(createServiceCtx(), processId),
		).toHaveLength(0);

		// Response should have resolved
		// biome-ignore lint/style/noNonNullAssertion: test assertion after null check
		expect(approvalResponse!).toEqual({ status: "approved", reason: null });
	});

	/**
	 * ROOT CAUSE TEST: Claude Code sends "hook_callback" (snake_case),
	 * NOT "hookCallback" (camelCase).
	 *
	 * This test uses the REAL message format captured from Claude Code stdout:
	 *   {"type":"control_request","request_id":"...","request":{"subtype":"hook_callback","callback_id":"tool_approval","input":{...}}}
	 *
	 * If this test FAILS, it means the server doesn't recognize the real format.
	 */
	test("REAL FORMAT: hook_callback (snake_case) + canUseTool creates approval", async () => {
		const approvalStore = new ApprovalStore();
		const approvalRepo = createMockApprovalRepo();
		const collector = new ProtocolLogCollector(
			createMockLogsRepo(),
			undefined,
			createMockLogger(),
		);

		const processId = "test-real-format";
		const hookResponsesSent: Array<{ decision: string }> = [];

		// tool_approval → "ask", others → "allow"
		collector.onHookCallback((_procId, _request) => {
			const callbackId = _request.request.callback_id as string | undefined;
			hookResponsesSent.push({
				decision: callbackId === TOOL_APPROVAL_CALLBACK_ID ? "ask" : "allow",
			});
		});

		collector.onApprovalRequest((_procId, request) => {
			const toolCallId =
				(request.request.tool_use_id as string) ?? request.request_id;
			const toolName = (request.request.tool_name as string) ?? "ExitPlanMode";
			const approval = Approval.create({
				executionProcessId: _procId,
				toolName,
				toolCallId,
			});
			approvalStore.createAndWait(createServiceCtx(), approval, approvalRepo);
		});

		// Use the REAL format from Claude Code stdout (captured from actual execution)
		const stdout = makeStream([
			{
				type: "control_request",
				request_id: "919a2988-0765-48b9-b84b-533475616c61",
				request: {
					subtype: "hook_callback", // <-- REAL: snake_case, not camelCase
					callback_id: "tool_approval",
					input: {
						session_id: "9ec9f649-ac19-4e4c-b535-b83f6bf30078",
						tool_name: "ExitPlanMode",
						tool_input: { plan: "test plan" },
					},
				},
			},
			{
				type: "control_request",
				request_id: "can-use-tool-real",
				request: {
					subtype: "canUseTool",
					tool_name: "ExitPlanMode",
					tool_use_id: "toolu_019fAd18yNHeAjnhCLP7UqFp",
				},
			},
		]);

		collector.collect(processId, stdout, emptyStream());
		await new Promise((r) => setTimeout(r, 100));

		// hook_callback should have been recognized and responded with "ask"
		expect(hookResponsesSent).toHaveLength(1);
		expect(hookResponsesSent[0].decision).toBe("ask");

		// Approval should be visible via listPending (client query)
		const pending = approvalStore.listPending(createServiceCtx(), processId);
		expect(pending).toHaveLength(1);
		expect(pending[0].toolName).toBe("ExitPlanMode");
	});

	/**
	 * Claude Code may also send "can_use_tool" (snake_case) instead of "canUseTool".
	 * Verify that both forms are routed to approval/auto-approve callbacks.
	 */
	test("REAL FORMAT: can_use_tool (snake_case) routes to approval callback", async () => {
		const approvalStore = new ApprovalStore();
		const approvalRepo = createMockApprovalRepo();
		const collector = new ProtocolLogCollector(
			createMockLogsRepo(),
			undefined,
			createMockLogger(),
		);

		const processId = "test-can-use-tool-snake";

		collector.onApprovalRequest((_procId, request) => {
			const toolCallId =
				(request.request.tool_use_id as string) ?? request.request_id;
			const toolName = (request.request.tool_name as string) ?? "ExitPlanMode";
			const approval = Approval.create({
				executionProcessId: _procId,
				toolName,
				toolCallId,
			});
			approvalStore.createAndWait(createServiceCtx(), approval, approvalRepo);
		});

		const autoApproved: string[] = [];
		collector.onAutoApprove((_procId, request) => {
			autoApproved.push(request.request.tool_name as string);
		});

		const stdout = makeStream([
			// ExitPlanMode via can_use_tool (snake_case)
			{
				type: "control_request",
				request_id: "cut-1",
				request: {
					subtype: "can_use_tool", // snake_case variant
					tool_name: "ExitPlanMode",
					tool_use_id: "toolu_exit1",
				},
			},
			// Regular tool via can_use_tool (snake_case)
			{
				type: "control_request",
				request_id: "cut-2",
				request: {
					subtype: "can_use_tool", // snake_case variant
					tool_name: "Bash",
					tool_use_id: "toolu_bash1",
				},
			},
		]);

		collector.collect(processId, stdout, emptyStream());
		await new Promise((r) => setTimeout(r, 100));

		// ExitPlanMode should create approval
		const pending = approvalStore.listPending(createServiceCtx(), processId);
		expect(pending).toHaveLength(1);
		expect(pending[0].toolName).toBe("ExitPlanMode");

		// Bash should be auto-approved
		expect(autoApproved).toEqual(["Bash"]);
	});

	/**
	 * Test that the initialize message always includes both ExitPlanMode
	 * and auto-approve hooks, regardless of permission mode.
	 */
	test("initialize sends both ExitPlanMode and auto-approve hooks for all modes", async () => {
		const { ClaudeCodeExecutor } = await import("./claude-code-executor");
		const executor = new ClaudeCodeExecutor();

		// Non-plan modes: ExitPlanMode + auto-approve hooks
		for (const mode of [
			"default",
			"bypassPermissions",
			"acceptEdits",
		] as const) {
			const written: string[] = [];
			const mockProcess = {
				proc: {} as never,
				stdin: {
					write(data: string) {
						written.push(data);
					},
					flush() {},
					end() {},
					start() {},
					ref() {},
					unref() {},
				} as never,
				stdout: new ReadableStream<Uint8Array>(),
				stderr: new ReadableStream<Uint8Array>(),
			};

			await executor.initialize(mockProcess, mode);

			const initMsg = JSON.parse(written[0].trim());
			expect(initMsg.request.hooks.PreToolUse).toHaveLength(2);
			expect(initMsg.request.hooks.PreToolUse[0].matcher).toBe(
				"^ExitPlanMode$",
			);
			expect(initMsg.request.hooks.PreToolUse[1].matcher).toBe(
				"^(?!ExitPlanMode$).*",
			);
			expect(initMsg.request.hooks.PreToolUse[1].hookCallbackIds).toEqual([
				AUTO_APPROVE_CALLBACK_ID,
			]);
		}

		// Plan mode: both hooks registered (auto-approve needed after ExitPlanMode approval)
		{
			const written: string[] = [];
			const mockProcess = {
				proc: {} as never,
				stdin: {
					write(data: string) {
						written.push(data);
					},
					flush() {},
				} as never,
				stdout: new ReadableStream<Uint8Array>(),
				stderr: new ReadableStream<Uint8Array>(),
			} as unknown as ClaudeCodeProcess;

			await executor.initialize(mockProcess, "plan");

			const initMsg = JSON.parse(written[0].trim());
			expect(initMsg.request.hooks.PreToolUse).toHaveLength(2);
			expect(initMsg.request.hooks.PreToolUse[0].matcher).toBe(
				"^ExitPlanMode$",
			);
			expect(initMsg.request.hooks.PreToolUse[1].matcher).toBe(
				"^(?!ExitPlanMode$).*",
			);
			expect(initMsg.request.hooks.PreToolUse[1].hookCallbackIds).toEqual([
				AUTO_APPROVE_CALLBACK_ID,
			]);
			expect(initMsg.request.hooks.PreToolUse[0].hookCallbackIds).toEqual([
				TOOL_APPROVAL_CALLBACK_ID,
			]);
		}
	});
});
