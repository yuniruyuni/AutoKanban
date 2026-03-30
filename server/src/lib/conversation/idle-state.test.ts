import { describe, expect, test } from "bun:test";
import { computeIdleState } from "./idle-state";

describe("computeIdleState", () => {
	test("result message → idle", () => {
		expect(computeIdleState("result")).toBe(true);
	});

	test("assistant message → not idle", () => {
		expect(computeIdleState("assistant")).toBe(false);
	});

	test("user message → not idle", () => {
		expect(computeIdleState("user")).toBe(false);
	});

	test("control_request with canUseTool → idle", () => {
		expect(computeIdleState("control_request", "canUseTool")).toBe(true);
	});

	test("control_request with can_use_tool → idle", () => {
		expect(computeIdleState("control_request", "can_use_tool")).toBe(true);
	});

	test("control_request with permission_request → idle", () => {
		expect(computeIdleState("control_request", "permission_request")).toBe(
			true,
		);
	});

	test("control_request with other subtype → no change", () => {
		expect(computeIdleState("control_request", "other")).toBeNull();
	});

	test("control_request without subtype → no change", () => {
		expect(computeIdleState("control_request")).toBeNull();
	});

	test("unknown message type → no change", () => {
		expect(computeIdleState("control_response")).toBeNull();
		expect(computeIdleState("unknown")).toBeNull();
	});
});
