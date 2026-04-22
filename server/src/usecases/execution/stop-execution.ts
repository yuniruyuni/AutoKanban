// @specre 01KPNSJ3QMPBNZVNKVC97HZB52
import { CodingAgentProcess } from "../../models/coding-agent-process";
import { fail } from "../../models/common";
import { usecase } from "../runner";

export const stopExecution = (executionProcessId: string) =>
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

			if (
				codingAgentProcess.status !== "running" &&
				codingAgentProcess.status !== "awaiting_approval"
			) {
				return fail("INVALID_STATE", "Coding agent process is not active", {
					status: codingAgentProcess.status,
				});
			}

			return { codingAgentProcess };
		},

		post: async (ctx, { codingAgentProcess }) => {
			// Stop the process
			const stopped = await ctx.repos.executor.stop(codingAgentProcess.id);

			return { stopped, executionProcessId: codingAgentProcess.id };
		},
	});
