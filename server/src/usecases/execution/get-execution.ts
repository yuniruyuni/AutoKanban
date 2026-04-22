// @specre 01KPNSJ3QT901FC4PHSRS0SPKV
import {
	CodingAgentProcess,
	type CodingAgentProcessLogs,
} from "../../models/coding-agent-process";
import { fail } from "../../models/common";
import { DevServerProcess } from "../../models/dev-server-process";
import { WorkspaceScriptProcess } from "../../models/workspace-script-process";
import { usecase } from "../runner";

export type ExecutionProcessUnion =
	| CodingAgentProcess
	| DevServerProcess
	| WorkspaceScriptProcess;

export const getExecution = (
	executionProcessId: string,
	includeLogs?: boolean,
) =>
	usecase({
		read: async (ctx) => {
			// Try each process type in order
			const codingAgentProcess = await ctx.repos.codingAgentProcess.get(
				CodingAgentProcess.ById(executionProcessId),
			);
			if (codingAgentProcess) {
				let logs: CodingAgentProcessLogs | null = null;
				if (includeLogs) {
					logs =
						await ctx.repos.codingAgentProcessLogs.getLogs(executionProcessId);
				}
				const result = {
					executionProcess: codingAgentProcess,
					logs,
				};
				return result;
			}

			const devServerProcess = await ctx.repos.devServerProcess.get(
				DevServerProcess.ById(executionProcessId),
			);
			if (devServerProcess) {
				const result = {
					executionProcess: devServerProcess,
					logs: null as CodingAgentProcessLogs | null,
				};
				return result;
			}

			const workspaceScriptProcess = await ctx.repos.workspaceScriptProcess.get(
				WorkspaceScriptProcess.ById(executionProcessId),
			);
			if (workspaceScriptProcess) {
				const result = {
					executionProcess: workspaceScriptProcess,
					logs: null as CodingAgentProcessLogs | null,
				};
				return result;
			}

			return fail("NOT_FOUND", "Execution process not found", {
				executionProcessId,
			});
		},
	});
