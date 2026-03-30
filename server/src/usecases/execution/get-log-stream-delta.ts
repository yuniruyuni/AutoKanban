import type { SSEDeltaResult } from "../../models/sse";
import { usecase } from "../runner";

// ============================================
// State tracked between delta calls
// ============================================

export interface LogStreamState {
	/** Character offset into the raw logs — next delta starts here */
	offset: number;
}

// ============================================
// Params (extracted from route)
// ============================================

export interface LogStreamParams {
	executionProcessId: string;
}

// ============================================
// Snapshot usecase
// ============================================

export const getLogStreamSnapshot = (params: LogStreamParams) =>
	usecase({
		read: async (ctx) => {
			const logs = await ctx.repos.executionProcessLogs.getLogs(
				params.executionProcessId,
			);
			return { logs };
		},

		process: (_ctx, { logs }): SSEDeltaResult<LogStreamState> => {
			if (!logs?.logs) {
				return {
					events: [],
					state: { offset: 0 },
				};
			}

			const content = logs.logs;
			return {
				events: content.length > 0 ? [{ type: "log", data: content }] : [],
				state: { offset: content.length },
			};
		},
	});

// ============================================
// Delta usecase
// ============================================

export const getLogStreamDelta = (
	params: LogStreamParams,
	state: LogStreamState,
) =>
	usecase({
		read: async (ctx) => {
			const logs = await ctx.repos.executionProcessLogs.getLogs(
				params.executionProcessId,
			);
			return { logs };
		},

		process: (_ctx, { logs }): SSEDeltaResult<LogStreamState> => {
			if (!logs?.logs || logs.logs.length <= state.offset) {
				return { events: [], state };
			}

			const newContent = logs.logs.slice(state.offset);
			return {
				events: [{ type: "log", data: newContent }],
				state: { offset: logs.logs.length },
			};
		},
	});
