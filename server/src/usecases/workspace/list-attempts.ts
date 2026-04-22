// @specre 01KPNSJ3QEEC6KYB370PM3CRT8
import { CodingAgentProcess } from "../../models/coding-agent-process";
import { Session } from "../../models/session";
import { Workspace } from "../../models/workspace";
import { usecase } from "../runner";

export interface AttemptSummary {
	workspaceId: string;
	attempt: number;
	branch: string;
	archived: boolean;
	sessionId: string | null;
	latestStatus: CodingAgentProcess.Status | null;
	createdAt: Date;
}

export const listAttempts = (taskId: string) =>
	usecase({
		read: async (ctx) => {
			// Get all workspaces for this task (including archived)
			const workspacePage = await ctx.repos.workspace.list(
				Workspace.ByTaskId(taskId),
				{ limit: 100, sort: { keys: ["createdAt", "id"], order: "asc" } },
			);

			const attempts: AttemptSummary[] = [];
			let activeAttempt: number | null = null;

			for (const workspace of workspacePage.items) {
				// Get latest session for this workspace
				const sessionPage = await ctx.repos.session.list(
					Session.ByWorkspaceId(workspace.id),
					{ limit: 1, sort: { keys: ["createdAt", "id"], order: "desc" } },
				);
				const session =
					sessionPage.items.length > 0 ? sessionPage.items[0] : null;

				let latestStatus: CodingAgentProcess.Status | null = null;

				if (session) {
					// Get latest coding agent process for this session
					const epPage = await ctx.repos.codingAgentProcess.list(
						CodingAgentProcess.BySessionId(session.id),
						{
							limit: 1,
							sort: { keys: ["createdAt", "id"], order: "desc" },
						},
					);
					if (epPage.items.length > 0) {
						latestStatus = epPage.items[0].status;
					}
				}

				attempts.push({
					workspaceId: workspace.id,
					attempt: workspace.attempt,
					branch: workspace.branch,
					archived: workspace.archived,
					sessionId: session?.id ?? null,
					latestStatus,
					createdAt: workspace.createdAt,
				});

				if (!workspace.archived) {
					activeAttempt = workspace.attempt;
				}
			}

			return { attempts, activeAttempt };
		},
	});
