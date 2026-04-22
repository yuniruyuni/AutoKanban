import { describe, expect, test } from "bun:test";
import type { LogSource } from "../log-store";
import {
	findInterruptedTaskTools,
	findPendingToolUses,
	parseLogsToConversation,
	pendingToolUsesToProtocolFormat,
} from "./conversation-parser";

// ============================================
// Test helpers
// ============================================

function makeLogLine(
	source: LogSource,
	data: string | object,
	ts = "2025-01-15T10:00:00.000Z",
): string {
	const content = typeof data === "string" ? data : JSON.stringify(data);
	return `[${ts}] [${source}] ${content}`;
}

function makeAssistantLog(
	content: Array<{ type: string; [key: string]: unknown }>,
	opts: Record<string, unknown> = {},
) {
	return {
		type: "assistant",
		message: { role: "assistant", content },
		...opts,
	};
}

function makeUserLog(
	content: string | Array<{ type: string; [key: string]: unknown }>,
	opts: Record<string, unknown> = {},
) {
	return {
		type: "user",
		message: { role: "user", content },
		...opts,
	};
}

// ============================================
// parseLogsToConversation - basic
// ============================================

describe("parseLogsToConversation()", () => {
	test("returns empty entries for empty input", () => {
		const result = parseLogsToConversation("");
		expect(result.entries).toEqual([]);
		expect(result.isIdle).toBe(false);
	});

	test("parses assistant text message", () => {
		const log = makeLogLine(
			"stdout",
			makeAssistantLog([{ type: "text", text: "Hello world" }]),
		);
		const result = parseLogsToConversation(log);
		expect(result.entries).toHaveLength(1);
		expect(result.entries[0].type.kind).toBe("assistant_message");
	});

	test("parses user text message (string content)", () => {
		const log = makeLogLine("stdout", makeUserLog("What is this?"));
		const result = parseLogsToConversation(log);
		expect(result.entries).toHaveLength(1);
		expect(result.entries[0].type.kind).toBe("user_message");
	});

	test("parses user text message (array content)", () => {
		const log = makeLogLine(
			"stdout",
			makeUserLog([{ type: "text", text: "Hello" }]),
		);
		const result = parseLogsToConversation(log);
		expect(result.entries).toHaveLength(1);
		expect(result.entries[0].type.kind).toBe("user_message");
	});

	test("parses user message from stdin source", () => {
		const log = makeLogLine("stdin", makeUserLog("I am typing into stdin"));
		const result = parseLogsToConversation(log);
		expect(result.entries).toHaveLength(1);
		expect(result.entries[0].type.kind).toBe("user_message");
		if (result.entries[0].type.kind === "user_message") {
			expect(result.entries[0].type.text).toBe("I am typing into stdin");
		}
	});

	test("parses stderr as error entry", () => {
		const log = makeLogLine("stderr", "Something went wrong");
		const result = parseLogsToConversation(log);
		expect(result.entries).toHaveLength(1);
		expect(result.entries[0].type.kind).toBe("error");
	});

	test("attaches stderr to running tool's result during tool execution", () => {
		const toolUseLog = makeLogLine(
			"stdout",
			makeAssistantLog([
				{
					type: "tool_use",
					id: "tool-1",
					name: "Bash",
					input: { command: "bun test" },
				},
			]),
			"2025-01-15T10:00:00.000Z",
		);
		const stderrLog = makeLogLine(
			"stderr",
			"$ bun test\nrunning tests...",
			"2025-01-15T10:00:01.000Z",
		);

		const result = parseLogsToConversation(toolUseLog + stderrLog);
		const toolEntry = result.entries.find((e) => e.type.kind === "tool");
		expect(toolEntry).toBeDefined();
		if (toolEntry?.type.kind === "tool") {
			expect(toolEntry.type.result).toBeDefined();
			expect(toolEntry.type.result?.output).toBe(
				"$ bun test\nrunning tests...",
			);
			expect(toolEntry.type.result?.isError).toBe(false);
		}
	});

	test("does not create error entry for stderr during tool execution", () => {
		const toolUseLog = makeLogLine(
			"stdout",
			makeAssistantLog([
				{
					type: "tool_use",
					id: "tool-1",
					name: "Bash",
					input: { command: "bun test" },
				},
			]),
			"2025-01-15T10:00:00.000Z",
		);
		const stderrLog = makeLogLine(
			"stderr",
			"some warning output",
			"2025-01-15T10:00:01.000Z",
		);

		const result = parseLogsToConversation(toolUseLog + stderrLog);
		const errorEntries = result.entries.filter((e) => e.type.kind === "error");
		expect(errorEntries).toHaveLength(0);
	});

	test("tool_result overwrites accumulated stderr", () => {
		const toolUseLog = makeLogLine(
			"stdout",
			makeAssistantLog([
				{
					type: "tool_use",
					id: "tool-1",
					name: "Bash",
					input: { command: "bun test" },
				},
			]),
			"2025-01-15T10:00:00.000Z",
		);
		const stderrLog = makeLogLine(
			"stderr",
			"intermediate stderr output",
			"2025-01-15T10:00:01.000Z",
		);
		const toolResultLog = makeLogLine(
			"stdout",
			makeUserLog([
				{
					type: "tool_result",
					tool_use_id: "tool-1",
					content: "final output from tool_result",
				},
			]),
			"2025-01-15T10:00:02.000Z",
		);

		const result = parseLogsToConversation(
			toolUseLog + stderrLog + toolResultLog,
		);
		const toolEntry = result.entries.find((e) => e.type.kind === "tool");
		expect(toolEntry).toBeDefined();
		if (toolEntry?.type.kind === "tool") {
			expect(toolEntry.type.result?.output).toBe(
				"final output from tool_result",
			);
		}
	});

	test("skips empty stderr", () => {
		const log = makeLogLine("stderr", "  ");
		const result = parseLogsToConversation(log);
		expect(result.entries).toHaveLength(0);
	});

	test("skips system messages", () => {
		const log = makeLogLine("stdout", { type: "system", cwd: "/tmp" });
		const result = parseLogsToConversation(log);
		expect(result.entries).toHaveLength(0);
	});

	test("skips result messages", () => {
		const log = makeLogLine("stdout", { type: "result", duration_ms: 100 });
		const result = parseLogsToConversation(log);
		expect(result.entries).toHaveLength(0);
	});
});

// ============================================
// Tool use parsing
// ============================================

describe("tool use parsing", () => {
	test("creates tool entry with running status", () => {
		const log = makeLogLine(
			"stdout",
			makeAssistantLog([
				{
					type: "tool_use",
					id: "tool-1",
					name: "Read",
					input: { file_path: "/foo.ts" },
				},
			]),
		);
		const result = parseLogsToConversation(log);
		expect(result.entries).toHaveLength(1);
		const entry = result.entries[0];
		expect(entry.type.kind).toBe("tool");
		if (entry.type.kind === "tool") {
			expect(entry.type.status).toBe("running");
			expect(entry.type.toolName).toBe("Read");
		}
	});

	test("tool_result updates tool status", () => {
		const toolUseLog = makeLogLine(
			"stdout",
			makeAssistantLog([
				{
					type: "tool_use",
					id: "tool-1",
					name: "Read",
					input: { file_path: "/foo.ts" },
				},
			]),
			"2025-01-15T10:00:00.000Z",
		);

		const toolResultLog = makeLogLine(
			"stdout",
			makeUserLog([
				{ type: "tool_result", tool_use_id: "tool-1", content: "file content" },
			]),
			"2025-01-15T10:00:01.000Z",
		);

		const result = parseLogsToConversation(toolUseLog + toolResultLog);
		const toolEntry = result.entries.find((e) => e.type.kind === "tool");
		expect(toolEntry).toBeDefined();
		if (toolEntry?.type.kind === "tool") {
			expect(toolEntry.type.status).toBe("success");
			expect(toolEntry.type.result).toBeDefined();
		}
	});

	test("failed tool_result sets failed status", () => {
		const toolUseLog = makeLogLine(
			"stdout",
			makeAssistantLog([
				{
					type: "tool_use",
					id: "tool-1",
					name: "Bash",
					input: { command: "fail" },
				},
			]),
			"2025-01-15T10:00:00.000Z",
		);

		const toolResultLog = makeLogLine(
			"stdout",
			makeUserLog([
				{
					type: "tool_result",
					tool_use_id: "tool-1",
					content: "error",
					is_error: true,
				},
			]),
			"2025-01-15T10:00:01.000Z",
		);

		const result = parseLogsToConversation(toolUseLog + toolResultLog);
		const toolEntry = result.entries.find((e) => e.type.kind === "tool");
		if (toolEntry?.type.kind === "tool") {
			expect(toolEntry.type.status).toBe("failed");
			expect(toolEntry.type.result?.isError).toBe(true);
		}
	});
});

// ============================================
// Thinking entries
// ============================================

describe("thinking entries", () => {
	test("parses thinking content", () => {
		const log = makeLogLine(
			"stdout",
			makeAssistantLog([
				{ type: "thinking", thinking: "Let me think about this..." },
			]),
		);
		const result = parseLogsToConversation(log);
		expect(result.entries).toHaveLength(1);
		expect(result.entries[0].type.kind).toBe("thinking");
	});

	test("skips empty thinking", () => {
		const log = makeLogLine(
			"stdout",
			makeAssistantLog([{ type: "thinking", thinking: "   " }]),
		);
		const result = parseLogsToConversation(log);
		expect(result.entries).toHaveLength(0);
	});
});

// ============================================
// isIdle tracking
// ============================================

describe("isIdle tracking", () => {
	test("isIdle is true after result", () => {
		const log = makeLogLine("stdout", { type: "result", duration_ms: 100 });
		const result = parseLogsToConversation(log);
		expect(result.isIdle).toBe(true);
	});

	test("isIdle is false after assistant message", () => {
		const assistantLog = makeLogLine(
			"stdout",
			makeAssistantLog([{ type: "text", text: "Working..." }]),
			"2025-01-15T10:00:00.000Z",
		);
		const resultLog = makeLogLine(
			"stdout",
			{ type: "result" },
			"2025-01-15T10:00:01.000Z",
		);
		const assistantLog2 = makeLogLine(
			"stdout",
			makeAssistantLog([{ type: "text", text: "More work..." }]),
			"2025-01-15T10:00:02.000Z",
		);

		const result = parseLogsToConversation(
			assistantLog + resultLog + assistantLog2,
		);
		expect(result.isIdle).toBe(false);
	});

	test("isIdle defaults to false", () => {
		const result = parseLogsToConversation("");
		expect(result.isIdle).toBe(false);
	});

	test("isIdle is true after canUseTool control_request", () => {
		const log = makeLogLine("stdout", {
			type: "control_request",
			request_id: "req-1",
			request: {
				subtype: "canUseTool",
				tool_name: "ExitPlanMode",
				tool_use_id: "tool-1",
			},
		});
		const result = parseLogsToConversation(log);
		expect(result.isIdle).toBe(true);
	});

	test("isIdle is true after permission_request control_request", () => {
		const log = makeLogLine("stdout", {
			type: "control_request",
			request_id: "req-1",
			request: {
				subtype: "permission_request",
				tool_name: "ExitPlanMode",
				tool_use_id: "tool-1",
			},
		});
		const result = parseLogsToConversation(log);
		expect(result.isIdle).toBe(true);
	});

	test("isIdle is true after can_use_tool (snake_case) control_request", () => {
		const log = makeLogLine("stdout", {
			type: "control_request",
			request_id: "req-1",
			request: {
				subtype: "can_use_tool",
				tool_name: "ExitPlanMode",
				tool_use_id: "tool-1",
			},
		});
		const result = parseLogsToConversation(log);
		expect(result.isIdle).toBe(true);
	});

	test("isIdle is false for hook_callback (snake_case) control_request", () => {
		const log = makeLogLine("stdout", {
			type: "control_request",
			request_id: "req-1",
			request: {
				subtype: "hook_callback",
				callback_id: "tool_approval",
			},
		});
		const result = parseLogsToConversation(log);
		expect(result.isIdle).toBe(false);
	});

	test("isIdle is false for hookCallback control_request", () => {
		const log = makeLogLine("stdout", {
			type: "control_request",
			request_id: "req-1",
			request: {
				subtype: "hookCallback",
				callback_id: "tool_approval",
			},
		});
		const result = parseLogsToConversation(log);
		expect(result.isIdle).toBe(false);
	});
});

// ============================================
// Subagent / synthetic filtering
// ============================================

describe("filtering", () => {
	test("skips subagent assistant messages", () => {
		const log = makeLogLine(
			"stdout",
			makeAssistantLog([{ type: "text", text: "subagent msg" }], {
				parent_tool_use_id: "parent-1",
			}),
		);
		const result = parseLogsToConversation(log);
		expect(result.entries).toHaveLength(0);
	});

	test("skips synthetic user messages", () => {
		const log = makeLogLine(
			"stdout",
			makeUserLog("synthetic", { isSynthetic: true }),
		);
		const result = parseLogsToConversation(log);
		expect(result.entries).toHaveLength(0);
	});

	test("skips replay user messages", () => {
		const log = makeLogLine(
			"stdout",
			makeUserLog("replay", { isReplay: true }),
		);
		const result = parseLogsToConversation(log);
		expect(result.entries).toHaveLength(0);
	});
});

// ============================================
// Stable IDs
// ============================================

describe("stable IDs", () => {
	test("same content produces same ID", () => {
		const log = makeLogLine(
			"stdout",
			makeAssistantLog([{ type: "text", text: "Same message" }]),
		);
		const result1 = parseLogsToConversation(log);
		const result2 = parseLogsToConversation(log);
		expect(result1.entries[0].id).toBe(result2.entries[0].id);
	});

	test("tool entries use Claude tool ID", () => {
		const log = makeLogLine(
			"stdout",
			makeAssistantLog([
				{ type: "tool_use", id: "toolu_abc123", name: "Read", input: {} },
			]),
		);
		const result = parseLogsToConversation(log);
		expect(result.entries[0].id).toBe("tool-toolu_abc123");
	});
});

// ============================================
// findPendingToolUses
// ============================================

describe("findPendingToolUses()", () => {
	test("returns tools without results", () => {
		const log = makeLogLine(
			"stdout",
			makeAssistantLog([
				{
					type: "tool_use",
					id: "tool-1",
					name: "Read",
					input: { file_path: "/foo.ts" },
				},
			]),
		);
		const pending = findPendingToolUses(log);
		expect(pending).toHaveLength(1);
		expect(pending[0].toolId).toBe("tool-1");
		expect(pending[0].toolName).toBe("Read");
	});

	test("excludes tools with results", () => {
		const toolUse = makeLogLine(
			"stdout",
			makeAssistantLog([
				{ type: "tool_use", id: "tool-1", name: "Read", input: {} },
			]),
			"2025-01-15T10:00:00.000Z",
		);
		const toolResult = makeLogLine(
			"stdout",
			makeUserLog([
				{ type: "tool_result", tool_use_id: "tool-1", content: "ok" },
			]),
			"2025-01-15T10:00:01.000Z",
		);

		const pending = findPendingToolUses(toolUse + toolResult);
		expect(pending).toHaveLength(0);
	});

	test("returns multiple pending tools", () => {
		const log = makeLogLine(
			"stdout",
			makeAssistantLog([
				{ type: "tool_use", id: "tool-1", name: "Read", input: {} },
				{ type: "tool_use", id: "tool-2", name: "Bash", input: {} },
			]),
		);
		const pending = findPendingToolUses(log);
		expect(pending).toHaveLength(2);
	});
});

// ============================================
// findInterruptedTaskTools
// ============================================

describe("findInterruptedTaskTools()", () => {
	test("returns only Task tools", () => {
		const log = makeLogLine(
			"stdout",
			makeAssistantLog([
				{ type: "tool_use", id: "tool-1", name: "Read", input: {} },
				{
					type: "tool_use",
					id: "tool-2",
					name: "Task",
					input: { prompt: "fix" },
				},
			]),
		);
		const interrupted = findInterruptedTaskTools(log);
		expect(interrupted).toHaveLength(1);
		expect(interrupted[0].toolName).toBe("Task");
	});

	test("returns empty when no Task tools are pending", () => {
		const toolUse = makeLogLine(
			"stdout",
			makeAssistantLog([
				{ type: "tool_use", id: "tool-1", name: "Task", input: {} },
			]),
			"2025-01-15T10:00:00.000Z",
		);
		const toolResult = makeLogLine(
			"stdout",
			makeUserLog([
				{ type: "tool_result", tool_use_id: "tool-1", content: "done" },
			]),
			"2025-01-15T10:00:01.000Z",
		);

		const interrupted = findInterruptedTaskTools(toolUse + toolResult);
		expect(interrupted).toHaveLength(0);
	});
});

// ============================================
// Control request/response (permission flow)
// ============================================

describe("control_request handling", () => {
	test("permission_request sets tool status to pending_approval", () => {
		const toolUseLog = makeLogLine(
			"stdout",
			makeAssistantLog([
				{
					type: "tool_use",
					id: "tool-1",
					name: "ExitPlanMode",
					input: { plan: "my plan" },
				},
			]),
			"2025-01-15T10:00:00.000Z",
		);
		const controlReqLog = makeLogLine(
			"stdout",
			{
				type: "control_request",
				request_id: "req-1",
				request: {
					subtype: "permission_request",
					tool_name: "ExitPlanMode",
					tool_use_id: "tool-1",
				},
			},
			"2025-01-15T10:00:01.000Z",
		);

		const result = parseLogsToConversation(toolUseLog + controlReqLog);
		const toolEntry = result.entries.find((e) => e.type.kind === "tool");
		expect(toolEntry).toBeDefined();
		if (toolEntry?.type.kind === "tool") {
			expect(toolEntry.type.status).toBe("pending_approval");
			expect(toolEntry.type.permissionRequestId).toBe("req-1");
		}
	});

	test("canUseTool sets tool status to pending_approval", () => {
		const toolUseLog = makeLogLine(
			"stdout",
			makeAssistantLog([
				{
					type: "tool_use",
					id: "tool-1",
					name: "ExitPlanMode",
					input: { plan: "my plan" },
				},
			]),
			"2025-01-15T10:00:00.000Z",
		);
		const controlReqLog = makeLogLine(
			"stdout",
			{
				type: "control_request",
				request_id: "req-2",
				request: {
					subtype: "canUseTool",
					tool_name: "ExitPlanMode",
					tool_use_id: "tool-1",
				},
			},
			"2025-01-15T10:00:01.000Z",
		);

		const result = parseLogsToConversation(toolUseLog + controlReqLog);
		const toolEntry = result.entries.find((e) => e.type.kind === "tool");
		expect(toolEntry).toBeDefined();
		if (toolEntry?.type.kind === "tool") {
			expect(toolEntry.type.status).toBe("pending_approval");
			expect(toolEntry.type.permissionRequestId).toBe("req-2");
		}
	});

	test("can_use_tool (snake_case) sets tool status to pending_approval", () => {
		const toolUseLog = makeLogLine(
			"stdout",
			makeAssistantLog([
				{
					type: "tool_use",
					id: "tool-1",
					name: "ExitPlanMode",
					input: { plan: "my plan" },
				},
			]),
			"2025-01-15T10:00:00.000Z",
		);
		const controlReqLog = makeLogLine(
			"stdout",
			{
				type: "control_request",
				request_id: "req-snake",
				request: {
					subtype: "can_use_tool",
					tool_name: "ExitPlanMode",
					tool_use_id: "tool-1",
				},
			},
			"2025-01-15T10:00:01.000Z",
		);

		const result = parseLogsToConversation(toolUseLog + controlReqLog);
		const toolEntry = result.entries.find((e) => e.type.kind === "tool");
		expect(toolEntry).toBeDefined();
		if (toolEntry?.type.kind === "tool") {
			expect(toolEntry.type.status).toBe("pending_approval");
			expect(toolEntry.type.permissionRequestId).toBe("req-snake");
		}
	});

	test("hookCallback does not set tool status", () => {
		const toolUseLog = makeLogLine(
			"stdout",
			makeAssistantLog([
				{
					type: "tool_use",
					id: "tool-1",
					name: "ExitPlanMode",
					input: { plan: "my plan" },
				},
			]),
			"2025-01-15T10:00:00.000Z",
		);
		const hookLog = makeLogLine(
			"stdout",
			{
				type: "control_request",
				request_id: "req-3",
				request: {
					subtype: "hookCallback",
					callback_id: "tool_approval",
				},
			},
			"2025-01-15T10:00:01.000Z",
		);

		const result = parseLogsToConversation(toolUseLog + hookLog);
		const toolEntry = result.entries.find((e) => e.type.kind === "tool");
		expect(toolEntry).toBeDefined();
		if (toolEntry?.type.kind === "tool") {
			expect(toolEntry.type.status).toBe("running");
		}
	});
});

describe("control_response handling", () => {
	function makeApprovalFlow(subtype: string) {
		const toolUseLog = makeLogLine(
			"stdout",
			makeAssistantLog([
				{
					type: "tool_use",
					id: "tool-1",
					name: "ExitPlanMode",
					input: { plan: "my plan" },
				},
			]),
			"2025-01-15T10:00:00.000Z",
		);
		const controlReqLog = makeLogLine(
			"stdout",
			{
				type: "control_request",
				request_id: "req-1",
				request: {
					subtype,
					tool_name: "ExitPlanMode",
					tool_use_id: "tool-1",
				},
			},
			"2025-01-15T10:00:01.000Z",
		);
		return { toolUseLog, controlReqLog };
	}

	test("legacy permission_response approve restores tool to running", () => {
		const { toolUseLog, controlReqLog } =
			makeApprovalFlow("permission_request");
		const responseLog = makeLogLine(
			"stdout",
			{
				type: "control_response",
				response: {
					subtype: "permission_response",
					approved: true,
				},
			},
			"2025-01-15T10:00:02.000Z",
		);

		const result = parseLogsToConversation(
			toolUseLog + controlReqLog + responseLog,
		);
		const toolEntry = result.entries.find((e) => e.type.kind === "tool");
		if (toolEntry?.type.kind === "tool") {
			expect(toolEntry.type.status).toBe("running");
			expect(toolEntry.type.action.type).toBe("plan");
			if (toolEntry.type.action.type === "plan") {
				expect(toolEntry.type.action.planStatus).toBe("approved");
			}
		}
	});

	test("legacy permission_response deny sets tool to denied", () => {
		const { toolUseLog, controlReqLog } =
			makeApprovalFlow("permission_request");
		const responseLog = makeLogLine(
			"stdout",
			{
				type: "control_response",
				response: {
					subtype: "permission_response",
					approved: false,
					reason: "Not good enough",
				},
			},
			"2025-01-15T10:00:02.000Z",
		);

		const result = parseLogsToConversation(
			toolUseLog + controlReqLog + responseLog,
		);
		const toolEntry = result.entries.find((e) => e.type.kind === "tool");
		if (toolEntry?.type.kind === "tool") {
			expect(toolEntry.type.status).toBe("denied");
		}
		// Should generate user_feedback entry
		const feedback = result.entries.find(
			(e) => e.type.kind === "user_feedback",
		);
		expect(feedback).toBeDefined();
	});

	test("new success/allow response approve restores tool to running", () => {
		const { toolUseLog, controlReqLog } = makeApprovalFlow("canUseTool");
		const responseLog = makeLogLine(
			"stdout",
			{
				type: "control_response",
				response: {
					subtype: "success",
					request_id: "req-1",
					response: {
						behavior: "allow",
						updatedPermissions: null,
					},
				},
			},
			"2025-01-15T10:00:02.000Z",
		);

		const result = parseLogsToConversation(
			toolUseLog + controlReqLog + responseLog,
		);
		const toolEntry = result.entries.find((e) => e.type.kind === "tool");
		if (toolEntry?.type.kind === "tool") {
			expect(toolEntry.type.status).toBe("running");
			expect(toolEntry.type.action.type).toBe("plan");
			if (toolEntry.type.action.type === "plan") {
				expect(toolEntry.type.action.planStatus).toBe("approved");
			}
		}
	});

	test("new success/deny response sets tool to denied", () => {
		const { toolUseLog, controlReqLog } = makeApprovalFlow("canUseTool");
		const responseLog = makeLogLine(
			"stdout",
			{
				type: "control_response",
				response: {
					subtype: "success",
					request_id: "req-1",
					response: {
						behavior: "deny",
						message: "Rejected by user",
					},
				},
			},
			"2025-01-15T10:00:02.000Z",
		);

		const result = parseLogsToConversation(
			toolUseLog + controlReqLog + responseLog,
		);
		const toolEntry = result.entries.find((e) => e.type.kind === "tool");
		if (toolEntry?.type.kind === "tool") {
			expect(toolEntry.type.status).toBe("denied");
		}
	});
});

// ============================================
// pendingToolUsesToProtocolFormat()
// ============================================

describe("pendingToolUsesToProtocolFormat()", () => {
	test("returns undefined for empty array", () => {
		expect(pendingToolUsesToProtocolFormat([])).toBeUndefined();
	});

	test("maps non-empty array to {toolId, toolName}[]", () => {
		const tools = [
			{ toolId: "t1", toolName: "Bash", input: { command: "ls" } },
			{ toolId: "t2", toolName: "Read", input: { path: "/a" } },
		];
		expect(pendingToolUsesToProtocolFormat(tools)).toEqual([
			{ toolId: "t1", toolName: "Bash" },
			{ toolId: "t2", toolName: "Read" },
		]);
	});

	test("strips input field from result", () => {
		const tools = [
			{ toolId: "t1", toolName: "Bash", input: { command: "ls" } },
		];
		const result = pendingToolUsesToProtocolFormat(tools);
		expect(result).toBeDefined();
		expect(result?.[0]).not.toHaveProperty("input");
	});
});
