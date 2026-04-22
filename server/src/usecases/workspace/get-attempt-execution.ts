import { CodingAgentProcess } from "../../models/coding-agent-process";
import { Session } from "../../models/session";
import { usecase } from "../runner";

export const getAttemptExecution = (workspaceId: string) =>
	usecase({
		read: async (ctx) => {
			// Find latest session for this workspace
			const sessionPage = await ctx.repos.session.list(
				Session.ByWorkspaceId(workspaceId),
				{ limit: 1, sort: { keys: ["createdAt", "id"], order: "desc" } },
			);

			if (sessionPage.items.length === 0) {
				return {
					workspaceId,
					sessionId: null,
					executionProcessId: null,
				};
			}

			const session = sessionPage.items[0];

			// Find latest coding agent process for this session
			const epPage = await ctx.repos.codingAgentProcess.list(
				CodingAgentProcess.BySessionId(session.id),
				{ limit: 1, sort: { keys: ["createdAt", "id"], order: "desc" } },
			);

			return {
				workspaceId,
				sessionId: session.id,
				executionProcessId: epPage.items.length > 0 ? epPage.items[0].id : null,
			};
		},
	});
