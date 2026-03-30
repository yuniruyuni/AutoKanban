import { CodingAgentTurn } from "../../models/coding-agent-turn";
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
		read: async (ctx) => {
			const session = await ctx.repos.session.get(
				Session.ById(input.sessionId),
			);
			if (!session) {
				return fail("NOT_FOUND", "Session not found", {
					sessionId: input.sessionId,
				});
			}

			// Get the latest execution process
			const executionProcessPage = await ctx.repos.executionProcess.list(
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
			const resumeInfo = await ctx.repos.codingAgentTurn?.findLatestResumeInfo(
				input.sessionId,
			);
			if (!resumeInfo?.agentSessionId) {
				return fail(
					"INVALID_STATE",
					"No agent session ID found for resumption",
				);
			}

			const workspace = await ctx.repos.workspace.get(
				Workspace.ById(session.workspaceId),
			);
			if (!workspace) {
				return fail("NOT_FOUND", "Workspace not found");
			}

			return { session, workspace, resumeInfo };
		},

		process: (_ctx, { session, workspace, resumeInfo }) => {
			const executionProcess = ExecutionProcess.create({
				sessionId: session.id,
				runReason: "codingagent",
			});
			const codingAgentTurn = CodingAgentTurn.create({
				executionProcessId: executionProcess.id,
				prompt: input.newPrompt,
			});
			return {
				session,
				workspace,
				agentSessionId: resumeInfo.agentSessionId,
				messageUuid: input.messageUuid,
				prompt: input.newPrompt,
				executionProcess,
				codingAgentTurn,
			};
		},

		write: async (ctx, data) => {
			await ctx.repos.executionProcess.upsert(data.executionProcess);
			await ctx.repos.codingAgentTurn.upsert(data.codingAgentTurn);
			return data;
		},

		post: async (
			ctx,
			{
				session,
				workspace,
				agentSessionId,
				messageUuid,
				prompt,
				executionProcess,
			},
		) => {
			// Start a new execution with --resume and --resume-session-at
			await ctx.repos.executor.startProtocol({
				id: executionProcess.id,
				sessionId: session.id,
				runReason: "codingagent",
				workingDir: workspace.worktreePath ?? ".",
				prompt,
				resumeSessionId: agentSessionId,
				resumeMessageId: messageUuid,
				// TODO: ExecutorStartProtocolOptions expects Full<> repos but post only has Service<>.
				// These repos are used asynchronously by the executor for log collection,
				// so they work correctly at runtime. Narrow the interface types in the future.
				// biome-ignore lint/suspicious/noExplicitAny: see TODO above
				logsRepo: ctx.repos.executionProcessLogs as any,
				// biome-ignore lint/suspicious/noExplicitAny: see TODO above
				codingAgentTurnRepo: ctx.repos.codingAgentTurn as any,
			});

			return {
				success: true,
				executionProcessId: executionProcess.id,
			};
		},

		result: ({ success, executionProcessId }): ForkConversationResult => ({
			success,
			executionProcessId,
		}),
	});
