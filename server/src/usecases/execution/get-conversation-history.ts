import { CodingAgentProcess } from "../../models/coding-agent-process";
import { CodingAgentTurn } from "../../models/coding-agent-turn";
import { fail } from "../../models/common";
import { Session } from "../../models/session";
import { usecase } from "../runner";

export interface ConversationTurn {
	id: string;
	executionProcessId: string;
	prompt: string | null;
	summary: string | null;
	status: CodingAgentProcess["status"];
	createdAt: Date;
}

/**
 * Gets the conversation history for a session.
 * Returns a list of turns with prompts and summaries.
 */
export const getConversationHistory = (sessionId: string) =>
	usecase({
		read: async (ctx) => {
			// Verify session exists
			const session = await ctx.repos.session.get(Session.ById(sessionId));
			if (!session) {
				return fail("NOT_FOUND", "Session not found", {
					sessionId,
				});
			}

			// Get all coding agent processes for this session (ordered by creation time)
			// All records in codingAgentProcess ARE codingagent - no filter needed
			const codingAgentProcesses: CodingAgentProcess[] = [];
			let hasMore = true;
			let cursor: Record<string, string> | undefined;

			while (hasMore) {
				const page = await ctx.repos.codingAgentProcess.list(
					CodingAgentProcess.BySessionId(sessionId),
					{
						limit: 100,
						after: cursor,
						sort: { keys: ["createdAt", "id"], order: "asc" },
					},
				);

				codingAgentProcesses.push(...page.items);
				hasMore = page.hasMore;
				cursor = page.nextCursor;
			}

			// Get coding agent turns for each process
			const turns: ConversationTurn[] = [];

			for (const process of codingAgentProcesses) {
				const turn = await ctx.repos.codingAgentTurn.get(
					CodingAgentTurn.ByExecutionProcessId(process.id),
				);

				turns.push({
					id: turn?.id ?? process.id,
					executionProcessId: process.id,
					prompt: turn?.prompt ?? null,
					summary: turn?.summary ?? null,
					status: process.status,
					createdAt: process.createdAt,
				});
			}

			return { sessionId, turns };
		},
	});
