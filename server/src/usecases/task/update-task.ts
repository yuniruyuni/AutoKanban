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
		read: (ctx) => {
			const task = ctx.repos.task.get(Task.ById(input.taskId));
			if (!task) {
				return fail("NOT_FOUND", "Task not found", { taskId: input.taskId });
			}

			// Chat Reset: collect related entity IDs when transitioning to "todo"
			const needsChatReset = input.status === "todo" && task.status !== "todo";

			const workspaceIds: string[] = [];
			let project: Project | null = null;

			if (needsChatReset) {
				project = ctx.repos.project.get(Project.ById(task.projectId));

				const workspaces = ctx.repos.workspace.list(
					Workspace.ByTaskId(task.id),
					{ limit: 10000 },
				);
				for (const ws of workspaces.items) {
					workspaceIds.push(ws.id);
				}
			}

			return {
				task,
				needsChatReset,
				workspaceIds,
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

		write: (ctx, { task, needsChatReset, workspaceIds, project }) => {
			ctx.repos.task.upsert(task);

			if (needsChatReset) {
				// Archive active workspaces instead of deleting them (preserve history)
				const workspaces = ctx.repos.workspace.list(
					Workspace.ByTaskId(task.id),
					{ limit: 10000 },
				);
				for (const ws of workspaces.items) {
					if (!ws.archived) {
						ctx.repos.workspace.upsert({
							...ws,
							archived: true,
							updatedAt: ctx.now,
						});
					}
				}
			}

			return { task, workspaceIds, project };
		},

		post: async (ctx, { task, workspaceIds, project }) => {
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
