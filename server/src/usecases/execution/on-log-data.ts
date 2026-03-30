import { usecase } from "../runner";

interface AppendExecutionLogInput {
	processId: string;
	source: "stdout" | "stderr";
	data: string;
}

export const appendExecutionLog = (input: AppendExecutionLogInput) =>
	usecase({
		write: async (ctx) => {
			const timestamp = new Date().toISOString();
			await ctx.repos.executionProcessLogs.appendLogs(
				input.processId,
				`[${timestamp}] [${input.source}] ${input.data}\n`,
			);
		},
	});
