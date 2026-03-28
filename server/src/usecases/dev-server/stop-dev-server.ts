import { fail } from "../../models/common";
import { ExecutionProcess } from "../../models/execution-process";
import { usecase } from "../runner";

export interface StopDevServerInput {
	executionProcessId: string;
}

export const stopDevServer = (input: StopDevServerInput) =>
	usecase({
		read: (ctx) => {
			const ep = ctx.repos.executionProcess.get(
				ExecutionProcess.ById(input.executionProcessId),
			);
			if (!ep) {
				return fail("NOT_FOUND", "Execution process not found");
			}
			if (ep.runReason !== "devserver") {
				return fail("INVALID_STATE", "Not a dev server process");
			}
			if (ep.status !== "running") {
				return fail("INVALID_STATE", "Dev server is not running");
			}
			return { executionProcess: ep };
		},

		write: (ctx, { executionProcess }) => {
			const updated = ExecutionProcess.complete(
				executionProcess,
				"killed",
				null,
			);
			ctx.repos.executionProcess.upsert(updated);
			return { executionProcess: updated };
		},

		post: (ctx, { executionProcess }) => {
			ctx.repos.devServer.stop(executionProcess.id);
			return { executionProcess };
		},

		result: () => ({ stopped: true }),
	});
