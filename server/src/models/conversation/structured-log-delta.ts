import type { SSEDeltaResult, SSEEvent } from "../sse";
import type { ParseResult } from "./conversation-parser";
import type { ConversationEntry } from "./types";

// ============================================
// State tracked between delta calls
// ============================================

export interface StructuredLogState {
	sentEntryIds: Set<string>;
	entryCount: number;
	isIdle: boolean;
}

// ============================================
// Snapshot (pure)
// ============================================

export function createSnapshot(
	parsed: ParseResult,
): SSEDeltaResult<StructuredLogState> {
	const sentEntryIds = new Set(
		parsed.entries.map((e: ConversationEntry) => e.id),
	);

	return {
		events: [
			{
				type: "snapshot",
				data: { entries: parsed.entries, isIdle: parsed.isIdle },
			},
		],
		state: {
			sentEntryIds,
			entryCount: parsed.entries.length,
			isIdle: parsed.isIdle,
		},
	};
}

// ============================================
// Delta computation (pure)
// ============================================

export function computeDelta(
	prev: StructuredLogState,
	parsed: ParseResult,
): SSEDeltaResult<StructuredLogState> {
	const events: SSEEvent[] = [];
	const newSentEntryIds = new Set(prev.sentEntryIds);

	// New entries
	for (const entry of parsed.entries) {
		if (!prev.sentEntryIds.has(entry.id)) {
			newSentEntryIds.add(entry.id);
			events.push({ type: "entry_add", data: entry });
		}
	}

	// Updated entries (last few that may have changed, e.g., tool status)
	if (parsed.entries.length !== prev.entryCount) {
		const startIdx = Math.max(0, prev.entryCount - 3);
		for (
			let i = startIdx;
			i < Math.min(parsed.entries.length, prev.entryCount);
			i++
		) {
			events.push({ type: "entry_update", data: parsed.entries[i] });
		}
	}

	// Idle state change
	if (parsed.isIdle !== prev.isIdle) {
		events.push({ type: "idle_changed", data: { isIdle: parsed.isIdle } });
	}

	return {
		events,
		state: {
			sentEntryIds: newSentEntryIds,
			entryCount: parsed.entries.length,
			isIdle: parsed.isIdle,
		},
	};
}
