import { describe, expect, test } from "bun:test";
import { CodingAgentProcess } from ".";

// ============================================
// CodingAgentProcess.canReceiveMessage()
// ============================================

describe("CodingAgentProcess.canReceiveMessage()", () => {
	test("returns true when process is null", () => {
		expect(CodingAgentProcess.canReceiveMessage(null, false)).toBe(true);
	});

	test("returns true when process is not running", () => {
		const process = CodingAgentProcess.complete(
			CodingAgentProcess.create({ sessionId: "s1" }),
			"completed",
			0,
		);
		expect(CodingAgentProcess.canReceiveMessage(process, false)).toBe(true);
	});

	test("returns true when process is running and idle", () => {
		const process = CodingAgentProcess.create({ sessionId: "s1" });
		expect(CodingAgentProcess.canReceiveMessage(process, true)).toBe(true);
	});

	test("returns false when process is running and not idle", () => {
		const process = CodingAgentProcess.create({ sessionId: "s1" });
		expect(CodingAgentProcess.canReceiveMessage(process, false)).toBe(false);
	});
});
