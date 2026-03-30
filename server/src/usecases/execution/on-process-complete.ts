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

		write: async (ctx, { existing }) => {
			if (existing) {
				const now = new Date();
				await ctx.repos.executionProcess.upsert({
					...existing,
					status: input.status,
					exitCode: input.exitCode,
					completedAt: now,
					updatedAt: now,
				});
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

			let workingDir: string | null = null;
			if (workspace.worktreePath) {
				workingDir = project
					? `${workspace.worktreePath}/${project.name}`
					: workspace.worktreePath;
			} else if (project) {
				workingDir = project.repoPath;
			}

			return { workingDir };
		},

		post: async (ctx, { workingDir }) => {
			if (!workingDir) return {};

			const rp = await ctx.repos.executor.start({
				sessionId: input.sessionId,
				runReason: "codingagent",
				workingDir,
				prompt: input.prompt,
			});

			// Create ExecutionProcess DB record
			const now = new Date();
			await ctx.repos.executionProcess.upsert({
				id: rp.id,
				sessionId: input.sessionId,
				runReason: "codingagent",
				status: "running",
				exitCode: null,
				startedAt: now,
				completedAt: null,
				createdAt: now,
				updatedAt: now,
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
			if (task && task.status === "inprogress") {
				await ctx.repos.task.upsert({
					...task,
					status: "inreview",
					updatedAt: new Date(),
				});
			}
			return {};
		},
	});
