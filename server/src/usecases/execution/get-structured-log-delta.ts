import {
	type ParseResult,
	parseLogsToConversation,
} from "../../models/conversation/conversation-parser";
import type { ConversationEntry } from "../../models/conversation/types";
import type { SSEDeltaResult, SSEEvent } from "../../presentation/sse/stream";
import { usecase } from "../runner";

// ============================================
// State tracked between delta calls
// ============================================

export interface StructuredLogState {
	sentEntryIds: Set<string>;
	entryCount: number;
	isIdle: boolean;
}

// ============================================
// Params (extracted from route)
// ============================================

export interface StructuredLogParams {
	executionProcessId: string;
}

// ============================================
// Snapshot usecase
// ============================================

export const getStructuredLogSnapshot = (params: StructuredLogParams) =>
	usecase({
		read: async (ctx) => {
			const logs = await ctx.repos.executionProcessLogs.getLogs(
				params.executionProcessId,
			);
			return { logs };
		},

		process: (_ctx, { logs }): SSEDeltaResult<StructuredLogState> => {
			if (!logs?.logs) {
				return {
					events: [],
					state: { sentEntryIds: new Set(), entryCount: 0, isIdle: false },
				};
			}

			const parsed = parseLogsToConversation(logs.logs);
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
		},
	});

// ============================================
// Delta usecase
// ============================================

export const getStructuredLogDelta = (
	params: StructuredLogParams,
	state: StructuredLogState,
) =>
	usecase({
		read: async (ctx) => {
			const logs = await ctx.repos.executionProcessLogs.getLogs(
				params.executionProcessId,
			);
			return { logs };
		},

		process: (_ctx, { logs }): SSEDeltaResult<StructuredLogState> => {
			if (!logs?.logs) {
				return { events: [], state };
			}

			const parsed = parseLogsToConversation(logs.logs);
			return computeDelta(state, parsed);
		},
	});

// ============================================
// Delta computation (pure)
// ============================================

function computeDelta(
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
