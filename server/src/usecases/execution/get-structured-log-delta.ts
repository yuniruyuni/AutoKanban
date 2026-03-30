import type { ConversationEntry } from "../../models/conversation/types";
import {
	type ParseResult,
	parseLogsToConversation,
} from "../../models/conversation/conversation-parser";
import { usecase } from "../runner";

export interface StructuredLogDeltaInput {
	executionProcessId: string;
	/** Entry IDs already sent to the client */
	sentEntryIds: Set<string>;
	/** Previous entry count for update detection */
	prevEntryCount: number;
	/** Previous idle state */
	prevIsIdle: boolean;
}

export interface StructuredLogEvent {
	type: "entry_add" | "entry_update" | "idle_changed" | "snapshot";
	data: unknown;
}

export interface StructuredLogDeltaOutput {
	events: StructuredLogEvent[];
	/** Updated state for next call */
	entryCount: number;
	isIdle: boolean;
	newEntryIds: string[];
}

export const getStructuredLogDelta = (input: StructuredLogDeltaInput) =>
	usecase({
		read: async (ctx) => {
			const logs = await ctx.repos.executionProcessLogs.getLogs(
				input.executionProcessId,
			);
			return { logs };
		},

		process: (_ctx, { logs }) => {
			if (!logs?.logs) {
				return {
					events: [] as StructuredLogEvent[],
					entryCount: input.prevEntryCount,
					isIdle: input.prevIsIdle,
					newEntryIds: [] as string[],
				};
			}

			const parsed = parseLogsToConversation(logs.logs);
			return computeDelta(input, parsed);
		},
	});

export const getStructuredLogSnapshot = (input: {
	executionProcessId: string;
}) =>
	usecase({
		read: async (ctx) => {
			const logs = await ctx.repos.executionProcessLogs.getLogs(
				input.executionProcessId,
			);
			return { logs };
		},

		process: (_ctx, { logs }) => {
			if (!logs?.logs) {
				return {
					events: [] as StructuredLogEvent[],
					entryCount: 0,
					isIdle: false,
					entryIds: [] as string[],
				};
			}

			const parsed = parseLogsToConversation(logs.logs);
			return {
				events: [
					{
						type: "snapshot" as const,
						data: { entries: parsed.entries, isIdle: parsed.isIdle },
					},
				],
				entryCount: parsed.entries.length,
				isIdle: parsed.isIdle,
				entryIds: parsed.entries.map((e: ConversationEntry) => e.id),
			};
		},
	});

function computeDelta(
	input: StructuredLogDeltaInput,
	parsed: ParseResult,
): StructuredLogDeltaOutput {
	const events: StructuredLogEvent[] = [];
	const newEntryIds: string[] = [];

	// New entries
	for (const entry of parsed.entries) {
		if (!input.sentEntryIds.has(entry.id)) {
			newEntryIds.push(entry.id);
			events.push({ type: "entry_add", data: entry });
		}
	}

	// Updated entries (last few that may have changed, e.g., tool status)
	if (parsed.entries.length !== input.prevEntryCount) {
		const startIdx = Math.max(0, input.prevEntryCount - 3);
		for (
			let i = startIdx;
			i < Math.min(parsed.entries.length, input.prevEntryCount);
			i++
		) {
			events.push({ type: "entry_update", data: parsed.entries[i] });
		}
	}

	// Idle state change
	if (parsed.isIdle !== input.prevIsIdle) {
		events.push({ type: "idle_changed", data: { isIdle: parsed.isIdle } });
	}

	return {
		events,
		entryCount: parsed.entries.length,
		isIdle: parsed.isIdle,
		newEntryIds,
	};
}
