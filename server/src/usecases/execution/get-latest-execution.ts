import {
	CodingAgentProcess,
	type CodingAgentProcessLogs,
} from "../../models/coding-agent-process";
import { Session } from "../../models/session";
import { Workspace } from "../../models/workspace";
import { usecase } from "../runner";

export interface GetLatestExecutionInput {
	taskId: string;
	includeLogs?: boolean;
}

export interface GetLatestExecutionResult {
	workspaceId: string | null;
	sessionId: string | null;
	executionProcess: CodingAgentProcess | null;
	logs?: CodingAgentProcessLogs | null;
}

/**
 * Gets the latest coding agent process for a task.
 * Follows the chain: Task -> Workspace -> Session -> CodingAgentProcess
 */
export const getLatestExecution = (input: GetLatestExecutionInput) =>
	usecase({
		read: async (ctx) => {
			// Find workspace by taskId
			const workspace = await ctx.repos.workspace.get(
				Workspace.ByTaskIdActive(input.taskId),
			);

			if (!workspace) {
				// No workspace means no execution has ever been started
				const result: GetLatestExecutionResult = {
					workspaceId: null,
					sessionId: null,
					executionProcess: null,
				};
				return result;
			}

			// Find latest session for this workspace
			const sessionPage = await ctx.repos.session.list(
				Session.ByWorkspaceId(workspace.id),
				{ limit: 1, sort: { keys: ["createdAt", "id"], order: "desc" } },
			);

			if (sessionPage.items.length === 0) {
				const result: GetLatestExecutionResult = {
					workspaceId: workspace.id,
					sessionId: null,
					executionProcess: null,
				};
				return result;
			}

			const session = sessionPage.items[0];

			// Find latest coding agent process for this session
			const executionPage = await ctx.repos.codingAgentProcess.list(
				CodingAgentProcess.BySessionId(session.id),
				{ limit: 1, sort: { keys: ["createdAt", "id"], order: "desc" } },
			);

			if (executionPage.items.length === 0) {
				const result: GetLatestExecutionResult = {
					workspaceId: workspace.id,
					sessionId: session.id,
					executionProcess: null,
				};
				return result;
			}

			const executionProcess = executionPage.items[0];

			// Optionally include logs
			let logs: CodingAgentProcessLogs | null = null;
			if (input.includeLogs) {
				logs = await ctx.repos.codingAgentProcessLogs.getLogs(
					executionProcess.id,
				);
			}

			const result: GetLatestExecutionResult = {
				workspaceId: workspace.id,
				sessionId: session.id,
				executionProcess,
				logs,
			};
			return result;
		},
	});
