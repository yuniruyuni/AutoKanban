import { ExecutionProcess } from "../../models/execution-process";
import { Session } from "../../models/session";
import { usecase } from "../runner";

export interface GetAttemptExecutionInput {
	workspaceId: string;
}

export interface GetAttemptExecutionResult {
	workspaceId: string;
	sessionId: string | null;
	executionProcessId: string | null;
}

export const getAttemptExecution = (input: GetAttemptExecutionInput) =>
	usecase({
		read: async (ctx): Promise<GetAttemptExecutionResult> => {
			// Find latest session for this workspace
			const sessionPage = await ctx.repos.session.list(
				Session.ByWorkspaceId(input.workspaceId),
				{ limit: 1, sort: { keys: ["createdAt", "id"], order: "desc" } },
			);

			if (sessionPage.items.length === 0) {
				return {
					workspaceId: input.workspaceId,
					sessionId: null,
					executionProcessId: null,
				};
			}

			const session = sessionPage.items[0];

			// Find latest codingagent execution process for this session
			const epPage = await ctx.repos.executionProcess.list(
				ExecutionProcess.BySessionId(session.id).and(
					ExecutionProcess.ByRunReason("codingagent"),
				),
				{ limit: 1, sort: { keys: ["createdAt", "id"], order: "desc" } },
			);

			return {
				workspaceId: input.workspaceId,
				sessionId: session.id,
				executionProcessId: epPage.items.length > 0 ? epPage.items[0].id : null,
			};
		},
	});
