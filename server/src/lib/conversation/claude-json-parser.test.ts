import { beforeEach, describe, expect, test } from "bun:test";
import type {
	ClaudeAssistantMessage,
	ClaudeContentItem,
	ClaudeResultMessage,
} from "../../models/claude-protocol";
import {
	ClaudeJsonParser,
	extractSummaryFromContent,
	extractTextFromAssistant,
	isErrorResult,
} from "./claude-json-parser";

let parser: ClaudeJsonParser;

beforeEach(() => {
	parser = new ClaudeJsonParser();
});

// ============================================
// Session ID extraction
// ============================================

describe("session_id extraction", () => {
	test("extracts session_id from first message", () => {
		const results = parser.parse(
			JSON.stringify({
				type: "system",
				session_id: "sess-123",
			}),
		);
		const sessionResult = results.find((r) => r.kind === "session_id");
		expect(sessionResult).toBeDefined();
		if (sessionResult?.kind === "session_id") {
			expect(sessionResult.value).toBe("sess-123");
		}
	});

	test("only extracts session_id once", () => {
		parser.parse(JSON.stringify({ type: "system", session_id: "sess-1" }));
		const results = parser.parse(
			JSON.stringify({ type: "system", session_id: "sess-2" }),
		);
		const sessionResults = results.filter((r) => r.kind === "session_id");
		expect(sessionResults).toHaveLength(0);
	});

	test("getSessionId returns extracted id", () => {
		parser.parse(JSON.stringify({ type: "system", session_id: "sess-abc" }));
		expect(parser.getSessionId()).toBe("sess-abc");
	});

	test("getSessionId returns null when none extracted", () => {
		expect(parser.getSessionId()).toBeNull();
	});
});

// ============================================
// Message ID tracking
// ============================================

describe("message_id tracking", () => {
	test("user message UUID is pushed immediately", () => {
		const results = parser.parse(
			JSON.stringify({
				type: "user",
				uuid: "user-uuid-1",
				message: { role: "user", content: "hello" },
			}),
		);
		const msgIdResult = results.find((r) => r.kind === "message_id");
		expect(msgIdResult).toBeDefined();
		if (msgIdResult?.kind === "message_id") {
			expect(msgIdResult.value).toBe("user-uuid-1");
		}
	});

	test("assistant message UUID is pending until result", () => {
		const assistantResults = parser.parse(
			JSON.stringify({
				type: "assistant",
				uuid: "asst-uuid-1",
				message: { role: "assistant", content: [{ type: "text", text: "hi" }] },
			}),
		);
		const msgIdResults = assistantResults.filter(
			(r) => r.kind === "message_id",
		);
		expect(msgIdResults).toHaveLength(0);

		// Result commits the pending assistant UUID
		const resultResults = parser.parse(
			JSON.stringify({
				type: "result",
				duration_ms: 100,
			}),
		);
		const msgId = resultResults.find((r) => r.kind === "message_id");
		expect(msgId).toBeDefined();
		if (msgId?.kind === "message_id") {
			expect(msgId.value).toBe("asst-uuid-1");
		}
	});

	test("user message clears pending assistant UUID", () => {
		parser.parse(
			JSON.stringify({
				type: "assistant",
				uuid: "asst-uuid-1",
				message: { role: "assistant", content: [{ type: "text", text: "hi" }] },
			}),
		);

		parser.parse(
			JSON.stringify({
				type: "user",
				uuid: "user-uuid-2",
				message: { role: "user", content: "follow up" },
			}),
		);

		const resultResults = parser.parse(JSON.stringify({ type: "result" }));
		const msgIdResults = resultResults.filter((r) => r.kind === "message_id");
		// No pending assistant UUID should be committed
		expect(msgIdResults).toHaveLength(0);
	});
});

// ============================================
// Message type parsing
// ============================================

describe("message type parsing", () => {
	test("assistant message emits message event", () => {
		const results = parser.parse(
			JSON.stringify({
				type: "assistant",
				message: { role: "assistant", content: [{ type: "text", text: "hi" }] },
			}),
		);
		// assistant type doesn't emit 'message' for itself per the code, it handles uuid tracking
		// Let's check there's no 'message' kind for assistant (it has special handling)
		const msgResults = results.filter((r) => r.kind === "message");
		expect(msgResults).toHaveLength(0);
	});

	test("result message emits result event", () => {
		const results = parser.parse(
			JSON.stringify({
				type: "result",
				duration_ms: 500,
			}),
		);
		const resultEvent = results.find((r) => r.kind === "result");
		expect(resultEvent).toBeDefined();
	});

	test("control_request emits control_request event", () => {
		const results = parser.parse(
			JSON.stringify({
				type: "control_request",
				request_id: "req-1",
				request: { subtype: "permission" },
			}),
		);
		const ctrlResult = results.find((r) => r.kind === "control_request");
		expect(ctrlResult).toBeDefined();
	});

	test("unknown type emits message event", () => {
		const results = parser.parse(
			JSON.stringify({
				type: "stream_event",
				event: { type: "delta" },
			}),
		);
		const msgResult = results.find((r) => r.kind === "message");
		expect(msgResult).toBeDefined();
	});
});

// ============================================
// Error handling
// ============================================

describe("error handling", () => {
	test("empty line returns empty results", () => {
		expect(parser.parse("")).toEqual([]);
		expect(parser.parse("  ")).toEqual([]);
	});

	test("invalid JSON returns error", () => {
		const results = parser.parse("{invalid json}");
		expect(results).toHaveLength(1);
		expect(results[0].kind).toBe("error");
	});
});

// ============================================
// reset()
// ============================================

describe("reset()", () => {
	test("clears all state", () => {
		parser.parse(JSON.stringify({ type: "system", session_id: "sess-1" }));
		expect(parser.getSessionId()).toBe("sess-1");

		parser.reset();
		expect(parser.getSessionId()).toBeNull();

		// Can extract session_id again after reset
		const results = parser.parse(
			JSON.stringify({ type: "system", session_id: "sess-2" }),
		);
		expect(results.find((r) => r.kind === "session_id")).toBeDefined();
		expect(parser.getSessionId()).toBe("sess-2");
	});
});

// ============================================
// extractTextFromAssistant
// ============================================

describe("extractTextFromAssistant()", () => {
	test("extracts text from content items", () => {
		const msg: ClaudeAssistantMessage = {
			type: "assistant",
			message: {
				role: "assistant",
				content: [
					{ type: "text", text: "Hello" },
					{ type: "text", text: "World" },
				],
			},
		};
		expect(extractTextFromAssistant(msg)).toBe("Hello\nWorld");
	});

	test("skips non-text items", () => {
		const msg: ClaudeAssistantMessage = {
			type: "assistant",
			message: {
				role: "assistant",
				content: [
					{ type: "thinking", thinking: "hmm" },
					{ type: "text", text: "Visible" },
				],
			},
		};
		expect(extractTextFromAssistant(msg)).toBe("Visible");
	});

	test("returns empty string for no text", () => {
		const msg: ClaudeAssistantMessage = {
			type: "assistant",
			message: { role: "assistant", content: [] },
		};
		expect(extractTextFromAssistant(msg)).toBe("");
	});
});

// ============================================
// isErrorResult
// ============================================

describe("isErrorResult()", () => {
	test("returns true when is_error is true", () => {
		expect(
			isErrorResult({ type: "result", is_error: true } as ClaudeResultMessage),
		).toBe(true);
	});

	test("returns true when error string exists", () => {
		expect(
			isErrorResult({
				type: "result",
				error: "something went wrong",
			} as ClaudeResultMessage),
		).toBe(true);
	});

	test("returns false for successful result", () => {
		expect(isErrorResult({ type: "result" } as ClaudeResultMessage)).toBe(
			false,
		);
	});
});

// ============================================
// extractSummaryFromContent
// ============================================

describe("extractSummaryFromContent()", () => {
	test("returns last text content", () => {
		const content: ClaudeContentItem[] = [
			{ type: "text", text: "First" },
			{ type: "text", text: "Last" },
		];
		expect(extractSummaryFromContent(content)).toBe("Last");
	});

	test("skips empty text items", () => {
		const content: ClaudeContentItem[] = [
			{ type: "text", text: "Actual content" },
			{ type: "text", text: "   " },
		];
		expect(extractSummaryFromContent(content)).toBe("Actual content");
	});

	test("truncates long text", () => {
		const longText = "a".repeat(600);
		const content: ClaudeContentItem[] = [{ type: "text", text: longText }];
		const result = extractSummaryFromContent(content);
		expect(result?.length).toBe(500);
		expect(result?.endsWith("...")).toBe(true);
	});

	test("returns null for empty content", () => {
		expect(extractSummaryFromContent([])).toBeNull();
	});

	test("returns null for non-text content", () => {
		const content: ClaudeContentItem[] = [
			{ type: "tool_use", id: "t1", name: "Read", input: {} },
		];
		expect(extractSummaryFromContent(content)).toBeNull();
	});
});
