// @specre 01KPNSHJVXRAQGH9C3HBFX3X2F
import { fail } from "../../models/common";
import { Project } from "../../models/project";
import { Task } from "../../models/task";
import { Workspace } from "../../models/workspace";
import { WorkspaceRepo } from "../../models/workspace-repo";
import { collectCascadeIds, executeCascadeDeletion } from "../cascade-deletion";
import { cleanupAndRemoveWorktrees } from "../run-cleanup-before-removal";
import { usecase } from "../runner";

export const deleteProject = (
	projectId: string,
	options?: { deleteWorktrees?: boolean },
) =>
	usecase({
		read: async (ctx) => {
			const project = await ctx.repos.project.get(Project.ById(projectId));
			if (!project) {
				return fail("NOT_FOUND", "Project not found", { projectId });
			}

			const tasks = await ctx.repos.task.list(Task.ByProject(projectId), {
				limit: 10000,
			});
			const taskIds = tasks.items.map((t) => t.id);

			// Collect workspaces from all tasks, then collect cascade IDs
			const allWorkspaces: Workspace[] = [];
			for (const tid of taskIds) {
				const workspaces = await ctx.repos.workspace.list(
					Workspace.ByTaskId(tid),
					{ limit: 10000 },
				);
				allWorkspaces.push(...workspaces.items);
			}
			const cascadeIds = await collectCascadeIds(ctx, allWorkspaces);

			return {
				project,
				taskIds,
				cascadeIds,
			};
		},

		write: async (ctx, { project, taskIds, cascadeIds }) => {
			await executeCascadeDeletion(ctx, cascadeIds);

			// 5. workspace_repos by project (project-specific cleanup)
			await ctx.repos.workspaceRepo.delete(
				WorkspaceRepo.ByProjectId(project.id),
			);

			// 6. workspaces (depend on tasks)
			for (const taskId of taskIds) {
				await ctx.repos.workspace.delete(Workspace.ByTaskId(taskId));
			}

			// 7. tasks (depend on project)
			await ctx.repos.task.delete(Task.ByProject(project.id));

			// 8. project
			await ctx.repos.project.delete(Project.ById(project.id));

			return {
				deleted: true,
				projectId: project.id,
				workspaceIds: cascadeIds.workspaceIds,
				project,
			};
		},

		post: async (ctx, { workspaceIds, project }) => {
			if (options?.deleteWorktrees) {
				await cleanupAndRemoveWorktrees(
					ctx.repos,
					ctx.logger,
					workspaceIds,
					project,
				);

				try {
					await ctx.repos.worktree.pruneWorktrees(project);
				} catch (error) {
					ctx.logger.error(
						`Failed to prune worktrees for project ${project.name}:`,
						error,
					);
				}
			}

			return { deleted: true, projectId: project.id };
		},
	});
