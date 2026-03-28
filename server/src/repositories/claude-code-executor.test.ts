import { describe, expect, test } from "bun:test";
import type { ClaudeCodeProcess } from "./claude-code-executor";
import { ClaudeCodeExecutor } from "./claude-code-executor";

// ============================================
// sendPermissionResponse format tests
// ============================================

/**
 * Creates a mock ClaudeCodeProcess that captures stdin writes.
 */
function createMockProcess() {
	const written: string[] = [];
	return {
		process: {
			proc: {} as never,
			stdin: {
				write(data: string) {
					written.push(data);
				},
				flush() {},
			} as never,
			stdout: new ReadableStream<Uint8Array>(),
			stderr: new ReadableStream<Uint8Array>(),
		} as ClaudeCodeProcess,
		written,
	};
}

// ============================================
// initialize tests
// ============================================

describe("initialize", () => {
	const executor = new ClaudeCodeExecutor();

	test("registers both hooks in non-plan modes", async () => {
		const { process, written } = createMockProcess();
		await executor.initialize(process, "default");

		expect(written.length).toBeGreaterThanOrEqual(2);
		const initMsg = JSON.parse(written[0].trim());
		expect(initMsg.type).toBe("control_request");
		expect(initMsg.request.subtype).toBe("initialize");
		expect(initMsg.request.hooks.PreToolUse).toHaveLength(2);
		expect(initMsg.request.hooks.PreToolUse[0].matcher).toBe("^ExitPlanMode$");
		expect(initMsg.request.hooks.PreToolUse[1].matcher).toBe("^(?!ExitPlanMode$).*");
	});

	test("registers both hooks in bypassPermissions mode", async () => {
		const { process, written } = createMockProcess();
		await executor.initialize(process, "bypassPermissions");

		const initMsg = JSON.parse(written[0].trim());
		expect(initMsg.request.hooks.PreToolUse).toBeDefined();
		expect(initMsg.request.hooks.PreToolUse).toHaveLength(2);
	});

	test("registers only ExitPlanMode hook in plan mode", async () => {
		const { process, written } = createMockProcess();
		await executor.initialize(process, "plan");

		const initMsg = JSON.parse(written[0].trim());
		expect(initMsg.request.hooks.PreToolUse).toHaveLength(1);
		expect(initMsg.request.hooks.PreToolUse[0].matcher).toBe("^ExitPlanMode$");
	});

	test("sends set_permission_mode after initialize", async () => {
		const { process, written } = createMockProcess();
		await executor.initialize(process, "plan");

		expect(written).toHaveLength(2);
		const permMsg = JSON.parse(written[1].trim());
		expect(permMsg.type).toBe("control_request");
		expect(permMsg.request.subtype).toBe("set_permission_mode");
		expect(permMsg.request.mode).toBe("plan");
	});
});

// ============================================
// buildProtocolArgs tests
// ============================================

describe("buildProtocolArgs", () => {
	const executor = new ClaudeCodeExecutor();
	// Access private method for testing
	const buildArgs = (options: Record<string, unknown>) =>
		// biome-ignore lint/suspicious/noExplicitAny: testing private method
		(executor as any).buildProtocolArgs(options) as string[];

	test("includes --disallowedTools=AskUserQuestion", () => {
		const args = buildArgs({ workingDir: "/tmp" });
		expect(args).toContain("--disallowedTools=AskUserQuestion");
	});
});

describe("sendPermissionResponse", () => {
	const executor = new ClaudeCodeExecutor();

	test("uses legacy format for permission_request subtype (approved)", async () => {
		const { process, written } = createMockProcess();
		await executor.sendPermissionResponse(
			process,
			"req-1",
			true,
			"permission_request",
		);

		expect(written).toHaveLength(1);
		const msg = JSON.parse(written[0].trim());
		expect(msg.type).toBe("control_response");
		expect(msg.request_id).toBe("req-1");
		expect(msg.response.subtype).toBe("permission_response");
		expect(msg.response.approved).toBe(true);
	});

	test("uses legacy format for permission_request subtype (denied with reason)", async () => {
		const { process, written } = createMockProcess();
		await executor.sendPermissionResponse(
			process,
			"req-2",
			false,
			"permission_request",
			"Not good enough",
		);

		expect(written).toHaveLength(1);
		const msg = JSON.parse(written[0].trim());
		expect(msg.response.subtype).toBe("permission_response");
		expect(msg.response.approved).toBe(false);
		expect(msg.response.reason).toBe("Not good enough");
	});

	test("uses new format for canUseTool subtype (approved)", async () => {
		const { process, written } = createMockProcess();
		await executor.sendPermissionResponse(
			process,
			"req-3",
			true,
			"canUseTool",
		);

		expect(written).toHaveLength(1);
		const msg = JSON.parse(written[0].trim());
		expect(msg.type).toBe("control_response");
		expect(msg.request_id).toBe("req-3");
		expect(msg.response.subtype).toBe("success");
		expect(msg.response.response.behavior).toBe("allow");
	});

	test("uses new format for canUseTool subtype (denied)", async () => {
		const { process, written } = createMockProcess();
		await executor.sendPermissionResponse(
			process,
			"req-4",
			false,
			"canUseTool",
			"Rejected",
		);

		expect(written).toHaveLength(1);
		const msg = JSON.parse(written[0].trim());
		expect(msg.response.subtype).toBe("success");
		expect(msg.response.response.behavior).toBe("deny");
		expect(msg.response.response.message).toContain("Rejected");
		expect(msg.response.response.interrupt).toBe(false);
	});

	test("passes updatedPermissions in new format (approved)", async () => {
		const { process, written } = createMockProcess();
		const perms = [
			{ type: "setMode", mode: "bypassPermissions", destination: "session" },
		];
		await executor.sendPermissionResponse(
			process,
			"req-5",
			true,
			"canUseTool",
			undefined,
			perms,
		);

		const msg = JSON.parse(written[0].trim());
		expect(msg.response.response.updatedPermissions).toEqual(perms);
	});

	test("defaults to new format when requestSubtype is undefined", async () => {
		const { process, written } = createMockProcess();
		await executor.sendPermissionResponse(process, "req-6", true);

		const msg = JSON.parse(written[0].trim());
		expect(msg.response.subtype).toBe("success");
		expect(msg.response.response.behavior).toBe("allow");
		// updatedPermissions must be omitted (not null) when not provided
		expect(msg.response.response.updatedPermissions).toBeUndefined();
	});
});

// ============================================
// sendHookResponse format tests
// ============================================

describe("sendHookResponse", () => {
	const executor = new ClaudeCodeExecutor();

	test("sends allow decision", async () => {
		const { process, written } = createMockProcess();
		await executor.sendHookResponse(process, "req-1", "allow");

		const msg = JSON.parse(written[0].trim());
		expect(msg.type).toBe("control_response");
		expect(msg.request_id).toBe("req-1");
		expect(msg.response.subtype).toBe("success");
		expect(msg.response.response.hookSpecificOutput.permissionDecision).toBe(
			"allow",
		);
		expect(
			msg.response.response.hookSpecificOutput.hookEventName,
		).toBe("PreToolUse");
	});

	test("sends ask decision with reason", async () => {
		const { process, written } = createMockProcess();
		await executor.sendHookResponse(
			process,
			"req-2",
			"ask",
			"Requires user approval",
		);

		const msg = JSON.parse(written[0].trim());
		expect(msg.response.response.hookSpecificOutput.permissionDecision).toBe(
			"ask",
		);
		expect(
			msg.response.response.hookSpecificOutput.permissionDecisionReason,
		).toBe("Requires user approval");
	});
});
