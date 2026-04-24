// @specre 01KPNSJ3RA08KSRZFYJ61HG2AB
import type { SSEDeltaResult } from "../../models/sse";
import type { ReadContext } from "../context";
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

/**
 * Resolve logs for an execution process by trying each of the three logs
 * tables in turn. The process-id space is unique across tables (ULIDs), so
 * whichever returns non-null is the authoritative source. Coding-agent is
 * tried first because it is the overwhelmingly common case.
 */
async function loadLogsFromAnySource(
	ctx: ReadContext,
	executionProcessId: string,
): Promise<{ logs: string } | null> {
	const coding =
		await ctx.repos.codingAgentProcessLogs.getLogs(executionProcessId);
	if (coding) return { logs: coding.logs };

	const dev = await ctx.repos.devServerProcessLogs.getLogs(executionProcessId);
	if (dev) return { logs: dev.logs };

	const script =
		await ctx.repos.workspaceScriptProcessLogs.getLogs(executionProcessId);
	if (script) return { logs: script.logs };

	return null;
}

// ============================================
// Snapshot usecase
// ============================================

export const getLogStreamSnapshot = (params: LogStreamParams) =>
	usecase({
		read: async (ctx) => {
			const logs = await loadLogsFromAnySource(ctx, params.executionProcessId);
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
			const logs = await loadLogsFromAnySource(ctx, params.executionProcessId);
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
