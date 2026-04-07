import type { LogSource } from "../../models/log-store";
import { usecase } from "../runner";

interface AppendExecutionLogInput {
	processId: string;
	source: LogSource;
	data: string;
}

export const appendExecutionLog = (input: AppendExecutionLogInput) =>
	usecase({
		write: async (ctx) => {
			const timestamp = new Date().toISOString();
			// Record the log line with timestamp and source prefix.
			// The conversation parser uses this exact format to split and parse logs.
			await ctx.repos.codingAgentProcessLogs.appendLogs(
				input.processId,
				`[${timestamp}] [${input.source}] ${input.data}\n`,
			);
		},
	});
