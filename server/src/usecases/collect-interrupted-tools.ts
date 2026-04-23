import type { CodingAgentProcess } from "../models/coding-agent-process";
import {
	findPendingToolUses,
	type PendingToolUse,
} from "../models/conversation/conversation-parser";

interface LogsReader {
	repos: {
		codingAgentProcessLogs: {
			getLogs(processId: string): Promise<{ logs: string } | null>;
		};
	};
}

/**
 * Detect interrupted tools from the logs of a non-running process.
 * These need synthetic error results to prevent Claude from getting stuck when resuming.
 *
 * Used by start-execution, queue-message, and on-process-complete.
 */
export async function collectInterruptedTools(
	ctx: LogsReader,
	latestProcess: CodingAgentProcess | null | undefined,
): Promise<PendingToolUse[]> {
	if (!latestProcess || latestProcess.status === "running") return [];
	const logs = await ctx.repos.codingAgentProcessLogs.getLogs(latestProcess.id);
	if (!logs?.logs) return [];
	return findPendingToolUses(logs.logs);
}
