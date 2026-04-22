// @specre 01KPNSHJWEV82CG0H0BXSJ9T8G
// @specre 01KPNSHJWAYW0CGTZ3AZ2HD42F
// @specre 01KPNSHJW5PQ99GFB1W694PSZ6
import { fail, isFail } from "../../models/common";
import { Project } from "../../models/project";
import { Task } from "../../models/task";
import { Workspace } from "../../models/workspace";
import { runCleanupIfConfigured } from "../run-cleanup-before-removal";
import { usecase } from "../runner";

export const updateTask = (taskId: string, fields: Task.UpdateFields) =>
	usecase({
		read: async (ctx) => {
			const task = await ctx.repos.task.get(Task.ById(taskId));
			if (!task) {
				return fail("NOT_FOUND", "Task not found", { taskId });
			}

			// Determine transition effects (model declares what's needed)
			const effects = fields.status
				? Task.transitionEffects(task.status, fields.status)
				: { shouldArchiveWorkspaces: false };

			let workspaces: Workspace[] = [];
			let project: Project | null = null;

			if (effects.shouldArchiveWorkspaces) {
				project = await ctx.repos.project.get(Project.ById(task.projectId));

				const workspacesPage = await ctx.repos.workspace.list(
					Workspace.ByTaskId(task.id),
					{ limit: 10000 },
				);
				workspaces = workspacesPage.items;
			}

			return {
				task,
				effects,
				workspaces,
				project,
			};
		},

		process: (ctx, { task, ...rest }) => {
			// Validate status transition if status is being changed
			if (fields.status) {
				const transition = Task.validateTransition(task.status, fields.status);
				if (isFail(transition)) return transition;
			}

			const updated = Task.applyUpdate(task, fields, ctx.now);

			return { task: updated, ...rest };
		},

		write: async (ctx, { task, effects, workspaces, project }) => {
			await ctx.repos.task.upsert(task);

			if (effects.shouldArchiveWorkspaces) {
				// Archive active workspaces instead of deleting them (preserve history)
				for (const ws of workspaces) {
					const archived = Workspace.archive(ws);
					if (archived) await ctx.repos.workspace.upsert(archived);
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
						const worktreePath = ctx.repos.worktree.getWorktreePath(
							wsId,
							project.name,
						);
						const exists = await ctx.repos.worktree.worktreeExists(
							wsId,
							project.name,
						);
						if (exists) {
							await runCleanupIfConfigured(ctx.repos, ctx.logger, worktreePath);
						}
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
