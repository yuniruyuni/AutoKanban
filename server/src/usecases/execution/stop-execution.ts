import { fail } from "../../models/common";
import { ExecutionProcess } from "../../models/execution-process";
import { usecase } from "../runner";

export interface StopExecutionInput {
	executionProcessId: string;
}

export const stopExecution = (input: StopExecutionInput) =>
	usecase({
		read: (ctx) => {
			// Verify execution process exists
			const executionProcess = ctx.repos.executionProcess.get(
				ExecutionProcess.ById(input.executionProcessId),
			);

			if (!executionProcess) {
				return fail("NOT_FOUND", "Execution process not found", {
					executionProcessId: input.executionProcessId,
				});
			}

			if (
				executionProcess.status !== "running" &&
				executionProcess.status !== "awaiting_approval"
			) {
				return fail("INVALID_STATE", "Execution process is not active", {
					status: executionProcess.status,
				});
			}

			return { executionProcess };
		},

		post: async (ctx, { executionProcess }) => {
			// Stop the process
			const stopped = await ctx.repos.executor.stop(executionProcess.id);

			return { stopped, executionProcessId: executionProcess.id };
		},
	});
