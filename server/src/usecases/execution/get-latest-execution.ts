import {
	ExecutionProcess,
	type ExecutionProcessLogs,
} from "../../models/execution-process";
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
	executionProcess: ExecutionProcess | null;
	logs?: ExecutionProcessLogs | null;
}

/**
 * Gets the latest execution process for a task.
 * Follows the chain: Task -> Workspace -> Session -> ExecutionProcess
 */
export const getLatestExecution = (input: GetLatestExecutionInput) =>
	usecase({
		read: (ctx) => {
			// Find workspace by taskId
			const workspace = ctx.repos.workspace.get(
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
			const sessionPage = ctx.repos.session.list(
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

			// Find latest execution process for this session
			const executionPage = ctx.repos.executionProcess.list(
				ExecutionProcess.BySessionId(session.id),
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
			let logs: ExecutionProcessLogs | null = null;
			if (input.includeLogs) {
				logs = ctx.repos.executionProcessLogs.getLogs(executionProcess.id);
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
