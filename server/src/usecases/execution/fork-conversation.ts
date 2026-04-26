// @specre 01KPNSJ3QQHP6GHD2JHE1RK26C
import { CodingAgentProcess } from "../../models/coding-agent-process";
import { fail } from "../../models/common";
import { Project } from "../../models/project";
import { Session } from "../../models/session";
import { Workspace } from "../../models/workspace";
import { WorkspaceRepo } from "../../models/workspace-repo";
import { usecase } from "../runner";

// ============================================
// Fork Conversation
// ============================================

/**
 * Fork a conversation at a specific message point and restart with a new prompt.
 * Uses Claude Code's --resume and --resume-session-at flags to rewind to the
 * specified message and continue from there.
 */
export const forkConversation = (
	sessionId: string,
	messageUuid: string,
	newPrompt: string,
	_options?: { executor?: string; variant?: string },
) =>
	usecase({
		read: async (ctx) => {
			const session = await ctx.repos.session.get(Session.ById(sessionId));
			if (!session) {
				return fail("NOT_FOUND", "Session not found", {
					sessionId,
				});
			}

			// Get the latest coding agent process
			const codingAgentProcessPage = await ctx.repos.codingAgentProcess.list(
				CodingAgentProcess.BySessionId(sessionId),
				{ limit: 1, sort: CodingAgentProcess.defaultSort },
			);
			const latestProcess = codingAgentProcessPage.items[0];

			if (!latestProcess) {
				return fail("NOT_FOUND", "No coding agent process found", {
					sessionId,
				});
			}

			if (latestProcess.status === "running") {
				return fail("INVALID_STATE", "Cannot fork while process is running", {
					processId: latestProcess.id,
				});
			}

			// Get resume info from CodingAgentTurn
			const resumeInfo =
				await ctx.repos.codingAgentTurn?.findLatestResumeInfo(sessionId);
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

			// Resolve the workspace's primary project so the executor's
			// workingDir lands inside the project's worktree subdir, not the
			// workspace parent dir. Mirrors the lookup queueMessage uses.
			const workspaceReposPage = await ctx.repos.workspaceRepo.list(
				WorkspaceRepo.ByWorkspaceId(workspace.id),
				{ limit: 1, sort: WorkspaceRepo.defaultSort },
			);
			const workspaceRepo = workspaceReposPage.items[0];
			const project = workspaceRepo
				? await ctx.repos.project.get(Project.ById(workspaceRepo.projectId))
				: null;

			return { session, workspace, project, resumeInfo };
		},

		process: (_ctx, { session, workspace, project, resumeInfo }) => {
			const { process: codingAgentProcess, turn: codingAgentTurn } =
				CodingAgentProcess.createWithTurn({
					sessionId: session.id,
					prompt: newPrompt,
				});
			return {
				session,
				workspace,
				project,
				agentSessionId: resumeInfo.agentSessionId,
				messageUuid,
				prompt: newPrompt,
				codingAgentProcess,
				codingAgentTurn,
			};
		},

		write: async (ctx, data) => {
			await ctx.repos.codingAgentProcess.upsert(data.codingAgentProcess);
			await ctx.repos.codingAgentTurn.upsert(data.codingAgentTurn);
			return data;
		},

		post: async (
			ctx,
			{
				session,
				workspace,
				project,
				agentSessionId,
				messageUuid,
				prompt,
				codingAgentProcess,
			},
		) => {
			// Start a new execution with --resume and --resume-session-at
			await ctx.repos.executor.startProtocol({
				id: codingAgentProcess.id,
				sessionId: session.id,
				runReason: "codingagent",
				workingDir: Workspace.resolveWorkingDir(workspace, project) ?? ".",
				prompt,
				resumeSessionId: agentSessionId,
				resumeMessageId: messageUuid,
			});

			return {
				success: true,
				executionProcessId: codingAgentProcess.id,
			};
		},

		result: ({ success, executionProcessId }) => ({
			success,
			executionProcessId,
		}),
	});
