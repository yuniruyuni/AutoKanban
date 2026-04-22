import { describe, expect, test } from "bun:test";
import { CodingAgentProcess } from ".";

// ============================================
// CodingAgentProcess.createWithTurn()
// ============================================

describe("CodingAgentProcess.createWithTurn()", () => {
	test("returns process and turn with matching executionProcessId", () => {
		const { process, turn } = CodingAgentProcess.createWithTurn({
			sessionId: "s1",
			prompt: "hello",
		});
		expect(turn.executionProcessId).toBe(process.id);
	});

	test("sets sessionId on the process", () => {
		const { process } = CodingAgentProcess.createWithTurn({
			sessionId: "s1",
			prompt: "hello",
		});
		expect(process.sessionId).toBe("s1");
	});

	test("sets prompt on the turn", () => {
		const { turn } = CodingAgentProcess.createWithTurn({
			sessionId: "s1",
			prompt: "do the thing",
		});
		expect(turn.prompt).toBe("do the thing");
	});

	test("process starts with running status", () => {
		const { process } = CodingAgentProcess.createWithTurn({
			sessionId: "s1",
			prompt: "hello",
		});
		expect(process.status).toBe("running");
	});
});

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
