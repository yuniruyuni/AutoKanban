import { fail } from "../../models/common";
import { ExecutionProcess } from "../../models/execution-process";
import { Session } from "../../models/session";
import { Workspace } from "../../models/workspace";
import { usecase } from "../runner";

// ============================================
// Fork Conversation
// ============================================

export interface ForkConversationInput {
	sessionId: string;
	messageUuid: string;
	newPrompt: string;
	executor?: string;
	variant?: string;
}

export interface ForkConversationResult {
	success: boolean;
	executionProcessId?: string;
}

/**
 * Fork a conversation at a specific message point and restart with a new prompt.
 * Uses Claude Code's --resume and --resume-session-at flags to rewind to the
 * specified message and continue from there.
 */
export const forkConversation = (input: ForkConversationInput) =>
	usecase({
		read: (ctx) => {
			const session = ctx.repos.session.get(Session.ById(input.sessionId));
			if (!session) {
				return fail("NOT_FOUND", "Session not found", {
					sessionId: input.sessionId,
				});
			}

			// Get the latest execution process
			const executionProcessPage = ctx.repos.executionProcess.list(
				ExecutionProcess.BySessionId(input.sessionId),
				{ limit: 1, sort: ExecutionProcess.defaultSort },
			);
			const latestProcess = executionProcessPage.items[0];

			if (!latestProcess) {
				return fail("NOT_FOUND", "No execution process found", {
					sessionId: input.sessionId,
				});
			}

			if (latestProcess.status === "running") {
				return fail("INVALID_STATE", "Cannot fork while process is running", {
					processId: latestProcess.id,
				});
			}

			// Get resume info from CodingAgentTurn
			const resumeInfo = ctx.repos.codingAgentTurn?.findLatestResumeInfo(
				input.sessionId,
			);
			if (!resumeInfo?.agentSessionId) {
				return fail(
					"INVALID_STATE",
					"No agent session ID found for resumption",
				);
			}

			return { session, resumeInfo };
		},

		process: (_ctx, { session, resumeInfo }) => {
			return {
				session,
				agentSessionId: resumeInfo.agentSessionId,
				messageUuid: input.messageUuid,
				prompt: input.newPrompt,
			};
		},

		post: async (ctx, { session, agentSessionId, messageUuid, prompt }) => {
			// Get workspace to find working directory
			const workspace = ctx.repos.workspace.get(
				Workspace.ById(session.workspaceId),
			);

			if (!workspace) {
				return { success: false };
			}

			// Start a new execution with --resume and --resume-session-at
			const processInfo = await ctx.repos.executor.startProtocol({
				sessionId: session.id,
				runReason: "codingagent",
				workingDir: workspace.worktreePath ?? ".",
				prompt,
				resumeSessionId: agentSessionId,
				resumeMessageId: messageUuid,
			});

			return {
				success: true,
				executionProcessId: processInfo.id,
			};
		},

		result: ({ success, executionProcessId }): ForkConversationResult => ({
			success,
			executionProcessId,
		}),
	});
