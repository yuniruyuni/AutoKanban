import { CodingAgentTurn } from "../../models/coding-agent-turn";
import {
	findPendingToolUses,
	type PendingToolUse,
} from "../../models/conversation/conversation-parser";
import { ExecutionProcess } from "../../models/execution-process";
import { Project } from "../../models/project";
import { Session } from "../../models/session";
import { Task } from "../../models/task";
import { Workspace } from "../../models/workspace";
import { WorkspaceRepo } from "../../models/workspace-repo";
import { usecase } from "../runner";

export interface ProcessCompletionInput {
	processId: string;
	sessionId: string;
	status: ExecutionProcess.Status;
	exitCode: number | null;
}

/**
 * Update ExecutionProcess status on completion.
 */
export const completeExecutionProcess = (input: ProcessCompletionInput) =>
	usecase({
		read: async (ctx) => {
			const existing = await ctx.repos.executionProcess.get(
				ExecutionProcess.ById(input.processId),
			);
			return { existing };
		},

		process: (_ctx, { existing }) => {
			const completed = existing
				? ExecutionProcess.complete(
						existing,
						input.status as "completed" | "failed" | "killed",
						input.exitCode,
					)
				: null;
			return { completed };
		},

		write: async (ctx, { completed }) => {
			if (completed) {
				await ctx.repos.executionProcess.upsert(completed);
			}
			return {};
		},

		post: async (ctx) => {
			ctx.repos.logStoreManager.close(input.processId);
			return {};
		},
	});

/**
 * Process queued follow-up message after process completion.
 * Uses protocol mode with session resume to continue the Claude Code conversation.
 */
export const processQueuedFollowUp = (input: {
	sessionId: string;
	prompt: string;
}) =>
	usecase({
		read: async (ctx) => {
			const session = await ctx.repos.session.get(
				Session.ById(input.sessionId),
			);
			if (!session)
				return {
					workingDir: null as string | null,
					resumeInfo: null,
					interruptedTools: [] as PendingToolUse[],
				};

			const workspace = await ctx.repos.workspace.get(
				Workspace.ById(session.workspaceId),
			);
			if (!workspace)
				return {
					workingDir: null as string | null,
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
			const resumeInfo = await ctx.repos.codingAgentTurn.findLatestResumeInfo(
				input.sessionId,
			);

			// Detect interrupted tools from the latest execution process logs
			let interruptedTools: PendingToolUse[] = [];
			if (resumeInfo) {
				const latestProcessPage = await ctx.repos.executionProcess.list(
					ExecutionProcess.BySessionId(input.sessionId),
					{ limit: 1, sort: ExecutionProcess.defaultSort },
				);
				const latestProcess = latestProcessPage.items[0];
				if (latestProcess && latestProcess.status !== "running") {
					const logs = await ctx.repos.executionProcessLogs.getLogs(
						latestProcess.id,
					);
					if (logs?.logs) {
						interruptedTools = findPendingToolUses(logs.logs);
					}
				}
			}

			return { workingDir, resumeInfo, interruptedTools };
		},

		process: (_ctx, { workingDir, resumeInfo, interruptedTools }) => {
			if (!workingDir)
				return {
					workingDir,
					executionProcess: null,
					turn: null,
					resumeInfo,
					interruptedTools,
				};
			const executionProcess = ExecutionProcess.create({
				sessionId: input.sessionId,
				runReason: "codingagent",
			});
			const turn = CodingAgentTurn.create({
				executionProcessId: executionProcess.id,
				prompt: input.prompt,
			});
			return {
				workingDir,
				executionProcess,
				turn,
				resumeInfo,
				interruptedTools,
			};
		},

		write: async (ctx, { executionProcess, turn, ...rest }) => {
			if (executionProcess) {
				await ctx.repos.executionProcess.upsert(executionProcess);
			}
			if (turn) {
				await ctx.repos.codingAgentTurn.upsert(turn);
			}
			return { ...rest, executionProcess };
		},

		post: async (
			ctx,
			{ workingDir, executionProcess, resumeInfo, interruptedTools },
		) => {
			if (!workingDir || !executionProcess) return {};

			await ctx.repos.executor.startProtocol({
				id: executionProcess.id,
				sessionId: input.sessionId,
				runReason: "codingagent",
				workingDir,
				prompt: input.prompt,
				resumeSessionId: resumeInfo?.agentSessionId,
				resumeMessageId: resumeInfo?.agentMessageId ?? undefined,
				interruptedTools:
					interruptedTools.length > 0
						? interruptedTools.map((t) => ({
								toolId: t.toolId,
								toolName: t.toolName,
							}))
						: undefined,
			});

			return {};
		},
	});

/**
 * Move a task associated with a session to inreview status.
 */
export const moveTaskToInReview = (input: { sessionId: string }) =>
	usecase({
		read: async (ctx) => {
			const session = await ctx.repos.session.get(
				Session.ById(input.sessionId),
			);
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
