// @specre 01KPNSHJW89KPCWYXKE4E261H9
import { fail } from "../../models/common";
import { Project } from "../../models/project";
import { Task } from "../../models/task";
import { Workspace } from "../../models/workspace";
import { collectCascadeIds, executeCascadeDeletion } from "../cascade-deletion";
import { cleanupAndRemoveWorktrees } from "../run-cleanup-before-removal";
import { usecase } from "../runner";

export const deleteTask = (
	taskId: string,
	options?: { deleteWorktrees?: boolean },
) =>
	usecase({
		read: async (ctx) => {
			const task = await ctx.repos.task.get(Task.ById(taskId));
			if (!task) {
				return fail("NOT_FOUND", "Task not found", { taskId });
			}

			const project = await ctx.repos.project.get(Project.ById(task.projectId));
			if (!project) {
				return fail("NOT_FOUND", "Project not found", {
					projectId: task.projectId,
				});
			}

			const workspacesPage = await ctx.repos.workspace.list(
				Workspace.ByTaskId(task.id),
				{ limit: 10000 },
			);
			const cascadeIds = await collectCascadeIds(ctx, workspacesPage.items);

			return {
				task,
				project,
				workspaces: workspacesPage.items,
				cascadeIds,
			};
		},

		write: async (ctx, { task, project, workspaces, cascadeIds }) => {
			await executeCascadeDeletion(ctx, cascadeIds);

			// 5. workspaces (depend on tasks)
			await ctx.repos.workspace.delete(Workspace.ByTaskId(task.id));

			// 6. task
			await ctx.repos.task.delete(Task.ById(task.id));

			return { deleted: true, taskId: task.id, workspaces, project };
		},

		post: async (ctx, { workspaces, project }) => {
			if (options?.deleteWorktrees) {
				await cleanupAndRemoveWorktrees(
					ctx.repos,
					ctx.logger,
					workspaces.map((ws) => ws.id),
					project,
				);
			}

			return { deleted: true, taskId };
		},
	});
