import { fail } from "../../models/common";
import { parseLogsToConversation } from "../../models/conversation/conversation-parser";
import type { ConversationEntry } from "../../models/conversation/types";
import { ExecutionProcess } from "../../models/execution-process";
import { usecase } from "../runner";

export interface GetStructuredLogsInput {
	executionProcessId: string;
}

export interface GetStructuredLogsResult {
	entries: ConversationEntry[];
	isIdle: boolean;
}

/**
 * Get structured conversation entries from execution process logs.
 * Converts raw JSON logs into UI-friendly conversation entries.
 * Also returns isIdle flag indicating if Claude is waiting for input.
 */
export const getStructuredLogs = (input: GetStructuredLogsInput) =>
	usecase({
		read: async (ctx) => {
			// Verify execution process exists
			const executionProcess = await ctx.repos.executionProcess.get(
				ExecutionProcess.ById(input.executionProcessId),
			);

			if (!executionProcess) {
				return fail("NOT_FOUND", "Execution process not found", {
					executionProcessId: input.executionProcessId,
				});
			}

			// Get logs
			const logs = await ctx.repos.executionProcessLogs.getLogs(
				input.executionProcessId,
			);
			if (!logs?.logs) {
				// Return empty entries if no logs yet
				const result: GetStructuredLogsResult = { entries: [], isIdle: false };
				return result;
			}

			// Parse logs into structured conversation entries
			const parseResult = parseLogsToConversation(logs.logs);

			const result: GetStructuredLogsResult = {
				entries: parseResult.entries,
				isIdle: parseResult.isIdle,
			};
			return result;
		},
	});
