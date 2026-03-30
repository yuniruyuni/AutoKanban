import { parseLogsToConversation } from "../../lib/conversation/conversation-parser";
import { fail } from "../../models/common";
import { ExecutionProcess } from "../../models/execution-process";
import type { ConversationEntry } from "../../types/conversation";
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
