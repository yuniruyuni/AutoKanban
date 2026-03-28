import { describe, expect, test } from "bun:test";
import type { ClaudeControlRequestMessage } from "../models/claude-protocol";
import type {
	ICodingAgentTurnRepository,
	IExecutionProcessLogsRepository,
} from "../types/repository";
import type { ILogger } from "../types/logger";
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

function createMockLogsRepo(): IExecutionProcessLogsRepository {
	return {
		appendLogs: () => {},
		getLogs: () => "",
	} as unknown as IExecutionProcessLogsRepository;
}

/**
 * Creates a ReadableStream from an array of JSON objects (one per line).
 */
function makeStream(lines: object[]): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	const data = lines.map((l) => JSON.stringify(l)).join("\n") + "\n";
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
// Callback routing tests
// ============================================

describe("ProtocolLogCollector callback routing", () => {
	test("permission_request with ExitPlanMode triggers approval callback", async () => {
		const collector = new ProtocolLogCollector(
			createMockLogsRepo(),
			undefined,
			createMockLogger(),
		);

		const approvalRequests: ClaudeControlRequestMessage[] = [];
		collector.onApprovalRequest((_processId, request) => {
			approvalRequests.push(request);
		});

		const stdout = makeStream([
			{
				type: "control_request",
				request_id: "req-1",
				request: {
					subtype: "permission_request",
					tool_name: "ExitPlanMode",
					tool_use_id: "tool-1",
				},
			},
		]);

		collector.collect("proc-1", stdout, emptyStream());
		// Wait for async stream processing
		await new Promise((r) => setTimeout(r, 50));

		expect(approvalRequests).toHaveLength(1);
		expect(approvalRequests[0].request_id).toBe("req-1");
	});

	test("permission_request with non-ExitPlanMode triggers auto-approve callback", async () => {
		const collector = new ProtocolLogCollector(
			createMockLogsRepo(),
			undefined,
			createMockLogger(),
		);

		const autoApproved: ClaudeControlRequestMessage[] = [];
		collector.onAutoApprove((_processId, request) => {
			autoApproved.push(request);
		});

		const stdout = makeStream([
			{
				type: "control_request",
				request_id: "req-2",
				request: {
					subtype: "permission_request",
					tool_name: "Read",
					tool_use_id: "tool-2",
				},
			},
		]);

		collector.collect("proc-1", stdout, emptyStream());
		await new Promise((r) => setTimeout(r, 50));

		expect(autoApproved).toHaveLength(1);
		expect(autoApproved[0].request.tool_name).toBe("Read");
	});

	test("canUseTool with ExitPlanMode triggers approval callback", async () => {
		const collector = new ProtocolLogCollector(
			createMockLogsRepo(),
			undefined,
			createMockLogger(),
		);

		const approvalRequests: ClaudeControlRequestMessage[] = [];
		collector.onApprovalRequest((_processId, request) => {
			approvalRequests.push(request);
		});

		const stdout = makeStream([
			{
				type: "control_request",
				request_id: "req-3",
				request: {
					subtype: "canUseTool",
					tool_name: "ExitPlanMode",
					tool_use_id: "tool-3",
				},
			},
		]);

		collector.collect("proc-1", stdout, emptyStream());
		await new Promise((r) => setTimeout(r, 50));

		expect(approvalRequests).toHaveLength(1);
		expect(approvalRequests[0].request_id).toBe("req-3");
	});

	test("canUseTool with non-ExitPlanMode triggers auto-approve callback", async () => {
		const collector = new ProtocolLogCollector(
			createMockLogsRepo(),
			undefined,
			createMockLogger(),
		);

		const autoApproved: ClaudeControlRequestMessage[] = [];
		collector.onAutoApprove((_processId, request) => {
			autoApproved.push(request);
		});

		const stdout = makeStream([
			{
				type: "control_request",
				request_id: "req-4",
				request: {
					subtype: "canUseTool",
					tool_name: "Bash",
					tool_use_id: "tool-4",
				},
			},
		]);

		collector.collect("proc-1", stdout, emptyStream());
		await new Promise((r) => setTimeout(r, 50));

		expect(autoApproved).toHaveLength(1);
	});

	test("hookCallback triggers hook callback", async () => {
		const collector = new ProtocolLogCollector(
			createMockLogsRepo(),
			undefined,
			createMockLogger(),
		);

		const hookRequests: ClaudeControlRequestMessage[] = [];
		collector.onHookCallback((_processId, request) => {
			hookRequests.push(request);
		});

		const stdout = makeStream([
			{
				type: "control_request",
				request_id: "req-5",
				request: {
					subtype: "hookCallback",
					callback_id: "tool_approval",
				},
			},
		]);

		collector.collect("proc-1", stdout, emptyStream());
		await new Promise((r) => setTimeout(r, 50));

		expect(hookRequests).toHaveLength(1);
		expect(hookRequests[0].request.callback_id).toBe("tool_approval");
	});

	test("full ExitPlanMode flow: hookCallback then canUseTool", async () => {
		const collector = new ProtocolLogCollector(
			createMockLogsRepo(),
			undefined,
			createMockLogger(),
		);

		const hookRequests: ClaudeControlRequestMessage[] = [];
		const approvalRequests: ClaudeControlRequestMessage[] = [];
		collector.onHookCallback((_processId, request) => {
			hookRequests.push(request);
		});
		collector.onApprovalRequest((_processId, request) => {
			approvalRequests.push(request);
		});

		const stdout = makeStream([
			{
				type: "control_request",
				request_id: "h1",
				request: {
					subtype: "hookCallback",
					callback_id: "tool_approval",
				},
			},
			{
				type: "control_request",
				request_id: "c1",
				request: {
					subtype: "canUseTool",
					tool_name: "ExitPlanMode",
					tool_use_id: "t1",
				},
			},
		]);

		collector.collect("proc-1", stdout, emptyStream());
		await new Promise((r) => setTimeout(r, 50));

		expect(hookRequests).toHaveLength(1);
		expect(hookRequests[0].request.callback_id).toBe("tool_approval");
		expect(approvalRequests).toHaveLength(1);
		expect(approvalRequests[0].request.tool_name).toBe("ExitPlanMode");
	});

	test("hookCallback with AUTO_APPROVE_CALLBACK_ID triggers hook callback (not approval)", async () => {
		const collector = new ProtocolLogCollector(
			createMockLogsRepo(),
			undefined,
			createMockLogger(),
		);

		const hookRequests: ClaudeControlRequestMessage[] = [];
		const approvalRequests: ClaudeControlRequestMessage[] = [];
		collector.onHookCallback((_processId, request) => {
			hookRequests.push(request);
		});
		collector.onApprovalRequest((_processId, request) => {
			approvalRequests.push(request);
		});

		const stdout = makeStream([
			{
				type: "control_request",
				request_id: "h2",
				request: {
					subtype: "hookCallback",
					callback_id: "AUTO_APPROVE_CALLBACK_ID",
				},
			},
		]);

		collector.collect("proc-1", stdout, emptyStream());
		await new Promise((r) => setTimeout(r, 50));

		expect(hookRequests).toHaveLength(1);
		expect(hookRequests[0].request.callback_id).toBe("AUTO_APPROVE_CALLBACK_ID");
		expect(approvalRequests).toHaveLength(0);
	});

	test("result triggers idle callback", async () => {
		const collector = new ProtocolLogCollector(
			createMockLogsRepo(),
			undefined,
			createMockLogger(),
		);

		const idleProcessIds: string[] = [];
		collector.onIdle((processId) => {
			idleProcessIds.push(processId);
		});

		const stdout = makeStream([
			{
				type: "result",
				duration_ms: 100,
			},
		]);

		collector.collect("proc-1", stdout, emptyStream());
		await new Promise((r) => setTimeout(r, 50));

		expect(idleProcessIds).toHaveLength(1);
		expect(idleProcessIds[0]).toBe("proc-1");
	});
});
