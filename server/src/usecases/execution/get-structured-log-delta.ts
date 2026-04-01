import { parseLogsToConversation } from "../../models/conversation/conversation-parser";
import {
	computeDelta,
	createSnapshot,
	type StructuredLogState,
} from "../../models/conversation/structured-log-delta";
import type { SSEDeltaResult } from "../../models/sse";
import { usecase } from "../runner";

export type { StructuredLogState };

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
			const logs = await ctx.repos.codingAgentProcessLogs.getLogs(
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
			return createSnapshot(parsed);
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
			const logs = await ctx.repos.codingAgentProcessLogs.getLogs(
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
