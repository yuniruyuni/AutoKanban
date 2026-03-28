import { CodingAgentTurn } from "../../models/coding-agent-turn";
import { fail } from "../../models/common";
import { ExecutionProcess } from "../../models/execution-process";
import { Session } from "../../models/session";
import { usecase } from "../runner";

export interface GetConversationHistoryInput {
	sessionId: string;
}

export interface ConversationTurn {
	id: string;
	executionProcessId: string;
	prompt: string | null;
	summary: string | null;
	status: ExecutionProcess["status"];
	createdAt: Date;
}

export interface GetConversationHistoryResult {
	sessionId: string;
	turns: ConversationTurn[];
}

/**
 * Gets the conversation history for a session.
 * Returns a list of turns with prompts and summaries.
 */
export const getConversationHistory = (input: GetConversationHistoryInput) =>
	usecase({
		read: (ctx) => {
			// Verify session exists
			const session = ctx.repos.session.get(Session.ById(input.sessionId));
			if (!session) {
				return fail("NOT_FOUND", "Session not found", {
					sessionId: input.sessionId,
				});
			}

			// Get all execution processes for this session (ordered by creation time)
			const executionProcesses: ExecutionProcess[] = [];
			let hasMore = true;
			let cursor: Record<string, string> | undefined;

			while (hasMore) {
				const page = ctx.repos.executionProcess.list(
					ExecutionProcess.BySessionId(input.sessionId),
					{
						limit: 100,
						after: cursor,
						sort: { keys: ["createdAt", "id"], order: "asc" },
					},
				);

				executionProcesses.push(...page.items);
				hasMore = page.hasMore;
				cursor = page.nextCursor;
			}

			// Get coding agent turns for each execution process
			const turns: ConversationTurn[] = [];

			for (const process of executionProcesses) {
				// Only include coding agent processes
				if (process.runReason !== "codingagent") {
					continue;
				}

				const turn = ctx.repos.codingAgentTurn.get(
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

			return { sessionId: input.sessionId, turns };
		},
	});
