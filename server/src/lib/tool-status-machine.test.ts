import { describe, expect, test } from "bun:test";
import {
	type ControlResponseInput,
	applyControlRequest,
	applyControlResponse,
	applyToolResult,
	normalizeControlResponse,
} from "./tool-status-machine";

describe("applyControlRequest", () => {
	test("canUseTool → pending_approval", () => {
		expect(applyControlRequest("canUseTool")).toBe("pending_approval");
	});

	test("can_use_tool → pending_approval", () => {
		expect(applyControlRequest("can_use_tool")).toBe("pending_approval");
	});

	test("permission_request → pending_approval", () => {
		expect(applyControlRequest("permission_request")).toBe("pending_approval");
	});

	test("unknown subtype → null", () => {
		expect(applyControlRequest("other")).toBeNull();
		expect(applyControlRequest("")).toBeNull();
	});
});

describe("normalizeControlResponse", () => {
	test("legacy format: approved", () => {
		const input: ControlResponseInput = {
			subtype: "permission_response",
			approved: true,
		};
		expect(normalizeControlResponse(input)).toEqual({ approved: true });
	});

	test("legacy format: denied with reason", () => {
		const input: ControlResponseInput = {
			subtype: "permission_response",
			approved: false,
			reason: "not allowed",
		};
		expect(normalizeControlResponse(input)).toEqual({
			approved: false,
			reason: "not allowed",
		});
	});

	test("legacy format: missing approved → null", () => {
		const input: ControlResponseInput = {
			subtype: "permission_response",
		};
		expect(normalizeControlResponse(input)).toBeNull();
	});

	test("new format: allow", () => {
		const input: ControlResponseInput = {
			subtype: "success",
			response: { behavior: "allow" },
		};
		expect(normalizeControlResponse(input)).toEqual({ approved: true });
	});

	test("new format: deny with message", () => {
		const input: ControlResponseInput = {
			subtype: "success",
			response: { behavior: "deny", message: "rejected by user" },
		};
		expect(normalizeControlResponse(input)).toEqual({
			approved: false,
			reason: "rejected by user",
		});
	});

	test("new format: missing behavior → null", () => {
		const input: ControlResponseInput = {
			subtype: "success",
			response: {},
		};
		expect(normalizeControlResponse(input)).toBeNull();
	});

	test("new format: missing response → null", () => {
		const input: ControlResponseInput = {
			subtype: "success",
		};
		expect(normalizeControlResponse(input)).toBeNull();
	});

	test("unknown subtype → null", () => {
		const input: ControlResponseInput = { subtype: "unknown" };
		expect(normalizeControlResponse(input)).toBeNull();
	});
});

describe("applyControlResponse", () => {
	test("approved → running", () => {
		const result = applyControlResponse(true, undefined, "Bash", "shell");
		expect(result).toEqual({ newStatus: "running" });
	});

	test("denied → denied", () => {
		const result = applyControlResponse(false, undefined, "Bash", "shell");
		expect(result).toEqual({ newStatus: "denied" });
	});

	test("denied with reason → denied + feedbackReason", () => {
		const result = applyControlResponse(false, "too risky", "Bash", "shell");
		expect(result).toEqual({
			newStatus: "denied",
			feedbackReason: "too risky",
		});
	});

	test("approved ExitPlanMode → running + planStatus approved", () => {
		const result = applyControlResponse(
			true,
			undefined,
			"ExitPlanMode",
			"plan",
		);
		expect(result).toEqual({
			newStatus: "running",
			planStatusUpdate: "approved",
		});
	});

	test("denied ExitPlanMode → denied + planStatus rejected", () => {
		const result = applyControlResponse(
			false,
			undefined,
			"ExitPlanMode",
			"plan",
		);
		expect(result).toEqual({
			newStatus: "denied",
			planStatusUpdate: "rejected",
		});
	});

	test("denied ExitPlanMode with reason → denied + planStatus rejected + feedbackReason", () => {
		const result = applyControlResponse(
			false,
			"bad plan",
			"ExitPlanMode",
			"plan",
		);
		expect(result).toEqual({
			newStatus: "denied",
			planStatusUpdate: "rejected",
			feedbackReason: "bad plan",
		});
	});

	test("approved non-ExitPlanMode with plan action → running without planStatus", () => {
		const result = applyControlResponse(
			true,
			undefined,
			"OtherTool",
			"plan",
		);
		expect(result).toEqual({ newStatus: "running" });
	});
});

describe("applyToolResult", () => {
	test("no error → success", () => {
		expect(applyToolResult(false)).toBe("success");
	});

	test("error → failed", () => {
		expect(applyToolResult(true)).toBe("failed");
	});
});
