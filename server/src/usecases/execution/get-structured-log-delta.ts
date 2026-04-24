import { CodingAgentProcess } from "../../models/coding-agent-process";
import {
	computeDelta,
	createSnapshot,
	type StructuredLogState,
} from "../../models/conversation/structured-log-delta";
import { Session } from "../../models/session";
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
			const process = await ctx.repos.codingAgentProcess.get(
				CodingAgentProcess.ById(params.executionProcessId),
			);
			const session = process
				? await ctx.repos.session.get(Session.ById(process.sessionId))
				: null;
			const logs = await ctx.repos.codingAgentProcessLogs.getLogs(
				params.executionProcessId,
			);
			const parser = ctx.repos.agent.getParser(session?.executor);
			return { logs, parser };
		},

		process: (_ctx, { logs, parser }): SSEDeltaResult<StructuredLogState> => {
			if (!logs?.logs) {
				return {
					events: [],
					state: { sentEntryIds: new Set(), entryCount: 0, isIdle: false },
				};
			}

			const parsed = parser.parse(logs.logs);
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
			const process = await ctx.repos.codingAgentProcess.get(
				CodingAgentProcess.ById(params.executionProcessId),
			);
			const session = process
				? await ctx.repos.session.get(Session.ById(process.sessionId))
				: null;
			const logs = await ctx.repos.codingAgentProcessLogs.getLogs(
				params.executionProcessId,
			);
			const parser = ctx.repos.agent.getParser(session?.executor);
			return { logs, parser };
		},

		process: (_ctx, { logs, parser }): SSEDeltaResult<StructuredLogState> => {
			if (!logs?.logs) {
				return { events: [], state };
			}

			const parsed = parser.parse(logs.logs);
			return computeDelta(state, parsed);
		},
	});
