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
			if (!session) return { workingDir: null as string | null };

			const workspace = await ctx.repos.workspace.get(
				Workspace.ById(session.workspaceId),
			);
			if (!workspace) return { workingDir: null as string | null };

			const workspaceReposPage = await ctx.repos.workspaceRepo.list(
				WorkspaceRepo.ByWorkspaceId(workspace.id),
				{ limit: 1, sort: WorkspaceRepo.defaultSort },
			);
			const wsRepo = workspaceReposPage.items[0];
			const project = wsRepo
				? await ctx.repos.project.get(Project.ById(wsRepo.projectId))
				: null;

			const workingDir = Workspace.resolveWorkingDir(workspace, project);

			return { workingDir };
		},

		process: (_ctx, { workingDir }) => {
			if (!workingDir) return { workingDir, executionProcess: null };
			const executionProcess = ExecutionProcess.create({
				sessionId: input.sessionId,
				runReason: "codingagent",
			});
			return { workingDir, executionProcess };
		},

		write: async (ctx, { executionProcess, ...rest }) => {
			if (executionProcess) {
				await ctx.repos.executionProcess.upsert(executionProcess);
			}
			return { ...rest, executionProcess };
		},

		post: async (ctx, { workingDir, executionProcess }) => {
			if (!workingDir || !executionProcess) return {};

			await ctx.repos.executor.start({
				id: executionProcess.id,
				sessionId: input.sessionId,
				runReason: "codingagent",
				workingDir,
				prompt: input.prompt,
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
