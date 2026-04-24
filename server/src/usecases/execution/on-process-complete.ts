// @specre 01KPNSJ3QVDJYEG9E5GBS6DDN2
import type { ProcessType } from "../../infra/callback/client";
import { CodingAgentProcess } from "../../models/coding-agent-process";
import {
	type PendingToolUse,
	pendingToolUsesToProtocolFormat,
} from "../../models/conversation/conversation-parser";
import { DevServerProcess } from "../../models/dev-server-process";
import { Project } from "../../models/project";
import { Session } from "../../models/session";
import { Task } from "../../models/task";
import { Workspace } from "../../models/workspace";
import { WorkspaceRepo } from "../../models/workspace-repo";
import { WorkspaceScriptProcess } from "../../models/workspace-script-process";
import { collectInterruptedTools } from "../collect-interrupted-tools";
import { usecase } from "../runner";

/**
 * Update process status on completion.
 * Routes to the correct typed repository based on processType.
 */
export const completeExecutionProcess = (
	processId: string,
	_sessionId: string,
	processType: ProcessType,
	status:
		| CodingAgentProcess.Status
		| DevServerProcess.Status
		| WorkspaceScriptProcess.Status,
	exitCode: number | null,
) =>
	usecase({
		read: async (ctx) => {
			switch (processType) {
				case "codingagent": {
					const existing = await ctx.repos.codingAgentProcess.get(
						CodingAgentProcess.ById(processId),
					);
					return { existing, processType };
				}
				case "devserver": {
					const existing = await ctx.repos.devServerProcess.get(
						DevServerProcess.ById(processId),
					);
					return { existing, processType };
				}
				case "workspacescript": {
					const existing = await ctx.repos.workspaceScriptProcess.get(
						WorkspaceScriptProcess.ById(processId),
					);
					return { existing, processType };
				}
			}
		},

		process: (_ctx, { existing, processType }) => {
			if (!existing) return { completed: null, processType };
			const completionStatus = status as "completed" | "failed" | "killed";
			switch (processType) {
				case "codingagent": {
					const completed = CodingAgentProcess.complete(
						existing as CodingAgentProcess,
						completionStatus,
						exitCode,
					);
					return { completed, processType };
				}
				case "devserver": {
					const completed = DevServerProcess.complete(
						existing as DevServerProcess,
						completionStatus,
						exitCode,
					);
					return { completed, processType };
				}
				case "workspacescript": {
					const completed = WorkspaceScriptProcess.complete(
						existing as WorkspaceScriptProcess,
						completionStatus,
						exitCode,
					);
					return { completed, processType };
				}
			}
		},

		write: async (ctx, { completed, processType }) => {
			if (!completed) return {};
			switch (processType) {
				case "codingagent":
					await ctx.repos.codingAgentProcess.upsert(
						completed as CodingAgentProcess,
					);
					break;
				case "devserver":
					await ctx.repos.devServerProcess.upsert(
						completed as DevServerProcess,
					);
					break;
				case "workspacescript":
					await ctx.repos.workspaceScriptProcess.upsert(
						completed as WorkspaceScriptProcess,
					);
					break;
			}
			return {};
		},

		post: async (ctx) => {
			ctx.repos.logStoreManager.close(processId);
			return {};
		},
	});

/**
 * Process queued follow-up message after process completion.
 * Uses protocol mode with session resume to continue the agent conversation.
 */
export const processQueuedFollowUp = (sessionId: string, prompt: string) =>
	usecase({
		read: async (ctx) => {
			const session = await ctx.repos.session.get(Session.ById(sessionId));
			if (!session) {
				return {
					workingDir: null as string | null,
					executor: null as string | null,
					resumeInfo: null,
					interruptedTools: [] as PendingToolUse[],
				};
			}

			const workspace = await ctx.repos.workspace.get(
				Workspace.ById(session.workspaceId),
			);
			if (!workspace)
				return {
					workingDir: null as string | null,
					executor: session.executor,
					resumeInfo: null,
					interruptedTools: [] as PendingToolUse[],
				};

			const workspaceReposPage = await ctx.repos.workspaceRepo.list(
				WorkspaceRepo.ByWorkspaceId(workspace.id),
				{ limit: 1, sort: WorkspaceRepo.defaultSort },
			);
			const wsRepo = workspaceReposPage.items[0];
			const project = wsRepo
				? await ctx.repos.project.get(Project.ById(wsRepo.projectId))
				: null;

			const workingDir = Workspace.resolveWorkingDir(workspace, project);

			// Get resume info for continuing the Claude Code session
			const resumeInfo =
				await ctx.repos.codingAgentTurn.findLatestResumeInfo(sessionId);

			// Detect interrupted tools from the latest coding agent process logs
			let interruptedTools: PendingToolUse[] = [];
			if (resumeInfo) {
				const latestProcessPage = await ctx.repos.codingAgentProcess.list(
					CodingAgentProcess.BySessionId(sessionId),
					{ limit: 1, sort: CodingAgentProcess.defaultSort },
				);
				interruptedTools = await collectInterruptedTools(
					ctx,
					latestProcessPage.items[0],
				);
			}

			return {
				workingDir,
				executor: session.executor,
				resumeInfo,
				interruptedTools,
			};
		},

		process: (_ctx, { workingDir, executor, resumeInfo, interruptedTools }) => {
			if (!workingDir)
				return {
					workingDir,
					executor,
					codingAgentProcess: null,
					turn: null,
					resumeInfo,
					interruptedTools,
				};
			const { process: codingAgentProcess, turn } =
				CodingAgentProcess.createWithTurn({
					sessionId,
					prompt,
				});
			return {
				workingDir,
				executor,
				codingAgentProcess,
				turn,
				resumeInfo,
				interruptedTools,
			};
		},

		write: async (ctx, { codingAgentProcess, turn, ...rest }) => {
			if (codingAgentProcess) {
				await ctx.repos.codingAgentProcess.upsert(codingAgentProcess);
			}
			if (turn) {
				await ctx.repos.codingAgentTurn.upsert(turn);
			}
			return { ...rest, codingAgentProcess };
		},

		post: async (
			ctx,
			{
				workingDir,
				executor,
				codingAgentProcess,
				resumeInfo,
				interruptedTools,
			},
		) => {
			if (!workingDir || !codingAgentProcess) return {};

			await ctx.repos.executor.startProtocol({
				id: codingAgentProcess.id,
				sessionId,
				runReason: "codingagent",
				workingDir,
				prompt,
				executor: executor ?? undefined,
				resumeSessionId: resumeInfo?.agentSessionId,
				resumeMessageId: resumeInfo?.agentMessageId ?? undefined,
				interruptedTools: pendingToolUsesToProtocolFormat(interruptedTools),
			});

			return {};
		},
	});

/**
 * Move a task associated with a session to inreview status.
 */
export const moveTaskToInReview = (sessionId: string) =>
	usecase({
		read: async (ctx) => {
			const session = await ctx.repos.session.get(Session.ById(sessionId));
			if (!session) return { task: null as Task | null };

			const workspace = await ctx.repos.workspace.get(
				Workspace.ById(session.workspaceId),
			);
			if (!workspace?.taskId) return { task: null as Task | null };

			const task = await ctx.repos.task.get(Task.ById(workspace.taskId));
			return { task };
		},

		write: async (ctx, { task }) => {
			if (task) {
				const updated = Task.toInReview(task);
				if (updated) {
					await ctx.repos.task.upsert(updated);
				}
			}
			return {};
		},
	});
