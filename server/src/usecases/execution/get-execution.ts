// @specre 01KPNSJ3QT901FC4PHSRS0SPKV
import {
	CodingAgentProcess,
	type CodingAgentProcessLogs,
} from "../../models/coding-agent-process";
import { fail } from "../../models/common";
import { DevServerProcess } from "../../models/dev-server-process";
import { WorkspaceScriptProcess } from "../../models/workspace-script-process";
import { usecase } from "../runner";

export interface GetExecutionInput {
	executionProcessId: string;
	includeLogs?: boolean;
}

export type ExecutionProcessUnion =
	| CodingAgentProcess
	| DevServerProcess
	| WorkspaceScriptProcess;

export interface GetExecutionResult {
	executionProcess: ExecutionProcessUnion;
	logs?: CodingAgentProcessLogs | null;
}

export const getExecution = (input: GetExecutionInput) =>
	usecase({
		read: async (ctx) => {
			// Try each process type in order
			const codingAgentProcess = await ctx.repos.codingAgentProcess.get(
				CodingAgentProcess.ById(input.executionProcessId),
			);
			if (codingAgentProcess) {
				let logs: CodingAgentProcessLogs | null = null;
				if (input.includeLogs) {
					logs = await ctx.repos.codingAgentProcessLogs.getLogs(
						input.executionProcessId,
					);
				}
				const result: GetExecutionResult = {
					executionProcess: codingAgentProcess,
					logs,
				};
				return result;
			}

			const devServerProcess = await ctx.repos.devServerProcess.get(
				DevServerProcess.ById(input.executionProcessId),
			);
			if (devServerProcess) {
				const result: GetExecutionResult = {
					executionProcess: devServerProcess,
				};
				return result;
			}

			const workspaceScriptProcess = await ctx.repos.workspaceScriptProcess.get(
				WorkspaceScriptProcess.ById(input.executionProcessId),
			);
			if (workspaceScriptProcess) {
				const result: GetExecutionResult = {
					executionProcess: workspaceScriptProcess,
				};
				return result;
			}

			return fail("NOT_FOUND", "Execution process not found", {
				executionProcessId: input.executionProcessId,
			});
		},
	});
