// @specre 01KPNSJ3RNADFZ6C4H1H2VF44S
import { CodingAgentProcess } from "../../models/coding-agent-process";
import { fail } from "../../models/common";
import { parseLogsToConversation } from "../../models/conversation/conversation-parser";
import { usecase } from "../runner";

/**
 * Get structured conversation entries from coding agent process logs.
 * Converts raw JSON logs into UI-friendly conversation entries.
 * Also returns isIdle flag indicating if Claude is waiting for input.
 */
export const getStructuredLogs = (executionProcessId: string) =>
	usecase({
		read: async (ctx) => {
			// Verify coding agent process exists
			const codingAgentProcess = await ctx.repos.codingAgentProcess.get(
				CodingAgentProcess.ById(executionProcessId),
			);

			if (!codingAgentProcess) {
				return fail("NOT_FOUND", "Coding agent process not found", {
					executionProcessId,
				});
			}

			// Get logs
			const logs =
				await ctx.repos.codingAgentProcessLogs.getLogs(executionProcessId);
			if (!logs?.logs) {
				// Return empty entries if no logs yet
				const result = { entries: [], isIdle: false };
				return result;
			}

			// Parse logs into structured conversation entries
			const parseResult = parseLogsToConversation(logs.logs);

			const result = {
				entries: parseResult.entries,
				isIdle: parseResult.isIdle,
			};
			return result;
		},
	});
