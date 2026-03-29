import { fail } from "../../models/common";
import {
	ExecutionProcess,
	type ExecutionProcessLogs,
} from "../../models/execution-process";
import { usecase } from "../runner";

export interface GetExecutionInput {
	executionProcessId: string;
	includeLogs?: boolean;
}

export interface GetExecutionResult {
	executionProcess: ExecutionProcess;
	logs?: ExecutionProcessLogs | null;
}

export const getExecution = (input: GetExecutionInput) =>
	usecase({
		read: async (ctx) => {
			const executionProcess = await ctx.repos.executionProcess.get(
				ExecutionProcess.ById(input.executionProcessId),
			);

			if (!executionProcess) {
				return fail("NOT_FOUND", "Execution process not found", {
					executionProcessId: input.executionProcessId,
				});
			}

			let logs: ExecutionProcessLogs | null = null;
			if (input.includeLogs) {
				logs = await ctx.repos.executionProcessLogs.getLogs(
					input.executionProcessId,
				);
			}

			const result: GetExecutionResult = { executionProcess, logs };
			return result;
		},
	});
