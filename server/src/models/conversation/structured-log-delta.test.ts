import { describe, expect, test } from "bun:test";
import type { ParseResult } from "./conversation-parser";
import {
	computeDelta,
	createSnapshot,
	type StructuredLogState,
} from "./structured-log-delta";
import type { ConversationEntry } from "./types";

function makeEntry(id: string): ConversationEntry {
	return {
		id,
		timestamp: "2025-01-01T00:00:00Z",
		type: { kind: "assistant_message", text: "hello" },
	} as ConversationEntry;
}

// ============================================
// createSnapshot()
// ============================================

describe("createSnapshot()", () => {
	test("returns snapshot event with all entries", () => {
		const parsed: ParseResult = {
			entries: [makeEntry("a"), makeEntry("b")],
			isIdle: false,
		};
		const result = createSnapshot(parsed);
		expect(result.events).toHaveLength(1);
		expect(result.events[0].type).toBe("snapshot");
		expect(result.state.sentEntryIds.size).toBe(2);
		expect(result.state.entryCount).toBe(2);
		expect(result.state.isIdle).toBe(false);
	});

	test("tracks idle state", () => {
		const parsed: ParseResult = { entries: [], isIdle: true };
		const result = createSnapshot(parsed);
		expect(result.state.isIdle).toBe(true);
	});
});

// ============================================
// computeDelta()
// ============================================

describe("computeDelta()", () => {
	test("emits entry_add for new entries", () => {
		const prev: StructuredLogState = {
			sentEntryIds: new Set(["a"]),
			entryCount: 1,
			isIdle: false,
		};
		const parsed: ParseResult = {
			entries: [makeEntry("a"), makeEntry("b")],
			isIdle: false,
		};
		const result = computeDelta(prev, parsed);
		const adds = result.events.filter((e) => e.type === "entry_add");
		expect(adds).toHaveLength(1);
		expect((adds[0].data as ConversationEntry).id).toBe("b");
	});

	test("emits entry_update for existing entries near boundary", () => {
		const prev: StructuredLogState = {
			sentEntryIds: new Set(["a", "b"]),
			entryCount: 2,
			isIdle: false,
		};
		const parsed: ParseResult = {
			entries: [makeEntry("a"), makeEntry("b"), makeEntry("c")],
			isIdle: false,
		};
		const result = computeDelta(prev, parsed);
		const updates = result.events.filter((e) => e.type === "entry_update");
		expect(updates.length).toBeGreaterThan(0);
	});

	test("emits idle_changed when idle state changes", () => {
		const prev: StructuredLogState = {
			sentEntryIds: new Set(),
			entryCount: 0,
			isIdle: false,
		};
		const parsed: ParseResult = { entries: [], isIdle: true };
		const result = computeDelta(prev, parsed);
		const idleEvents = result.events.filter((e) => e.type === "idle_changed");
		expect(idleEvents).toHaveLength(1);
	});

	test("does not emit idle_changed when idle state unchanged", () => {
		const prev: StructuredLogState = {
			sentEntryIds: new Set(),
			entryCount: 0,
			isIdle: true,
		};
		const parsed: ParseResult = { entries: [], isIdle: true };
		const result = computeDelta(prev, parsed);
		const idleEvents = result.events.filter((e) => e.type === "idle_changed");
		expect(idleEvents).toHaveLength(0);
	});

	test("returns empty events when nothing changed", () => {
		const prev: StructuredLogState = {
			sentEntryIds: new Set(["a"]),
			entryCount: 1,
			isIdle: false,
		};
		const parsed: ParseResult = {
			entries: [makeEntry("a")],
			isIdle: false,
		};
		const result = computeDelta(prev, parsed);
		expect(result.events).toHaveLength(0);
	});
});
