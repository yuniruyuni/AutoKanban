import { fail } from "../../models/common";
import { Project } from "../../models/project";
import { Task } from "../../models/task";
import { Workspace } from "../../models/workspace";
import { usecase } from "../runner";

export interface UpdateTaskInput {
	taskId: string;
	title?: string;
	description?: string | null;
	status?: Task.Status;
}

export const updateTask = (input: UpdateTaskInput) =>
	usecase({
		read: async (ctx) => {
			const task = await ctx.repos.task.get(Task.ById(input.taskId));
			if (!task) {
				return fail("NOT_FOUND", "Task not found", { taskId: input.taskId });
			}

			// Chat Reset: collect related entity IDs when transitioning to "todo"
			const needsChatReset = input.status
				? Task.needsChatReset(task.status, input.status)
				: false;

			let workspaces: Workspace[] = [];
			let project: Project | null = null;

			if (needsChatReset) {
				project = await ctx.repos.project.get(Project.ById(task.projectId));

				const workspacesPage = await ctx.repos.workspace.list(
					Workspace.ByTaskId(task.id),
					{ limit: 10000 },
				);
				workspaces = workspacesPage.items;
			}

			return {
				task,
				needsChatReset,
				workspaces,
				project,
			};
		},

		process: (ctx, { task, ...rest }) => {
			// Validate status transition if status is being changed
			if (input.status && input.status !== task.status) {
				if (!Task.canTransition(task.status, input.status)) {
					return fail(
						"INVALID_TRANSITION",
						`Cannot transition from ${task.status} to ${input.status}`,
						{
							from: task.status,
							to: input.status,
							allowed: Task.getAllowedTransitions(task.status),
						},
					);
				}
			}

			const updated: Task = {
				...task,
				title: input.title ?? task.title,
				description:
					input.description !== undefined
						? input.description
						: task.description,
				status: input.status ?? task.status,
				updatedAt: ctx.now,
			};

			return { task: updated, ...rest };
		},

		write: async (ctx, { task, needsChatReset, workspaces, project }) => {
			await ctx.repos.task.upsert(task);

			if (needsChatReset) {
				// Archive active workspaces instead of deleting them (preserve history)
				for (const ws of workspaces) {
					if (!ws.archived) {
						await ctx.repos.workspace.upsert({
							...ws,
							archived: true,
							updatedAt: ctx.now,
						});
					}
				}
			}

			return { task, workspaces, project };
		},

		post: async (ctx, { task, workspaces, project }) => {
			const workspaceIds = workspaces.map((ws) => ws.id);
			if (workspaceIds.length > 0 && project) {
				// Remove worktree directories but preserve branches
				for (const wsId of workspaceIds) {
					try {
						await ctx.repos.worktree.removeAllWorktrees(
							wsId,
							[project],
							true,
							false, // deleteBranch: false — preserve branches for history
						);
					} catch (error) {
						ctx.logger.error(
							`Failed to remove worktrees for workspace ${wsId}:`,
							error,
						);
					}
				}

				try {
					await ctx.repos.worktree.pruneWorktrees(project);
				} catch (error) {
					ctx.logger.error(
						`Failed to prune worktrees for task ${task.id}:`,
						error,
					);
				}
			}

			return task;
		},
	});
