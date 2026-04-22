// @specre 01KPNSHJW89KPCWYXKE4E261H9
import { CodingAgentProcess } from "../../models/coding-agent-process";
import { fail } from "../../models/common";
import { DevServerProcess } from "../../models/dev-server-process";
import { Project } from "../../models/project";
import { Session } from "../../models/session";
import { Task } from "../../models/task";
import { Workspace } from "../../models/workspace";
import { WorkspaceScriptProcess } from "../../models/workspace-script-process";
import { executeCascadeDeletion } from "../cascade-deletion";
import { runCleanupIfConfigured } from "../run-cleanup-before-removal";
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

			// Collect all related entity IDs for cascade deletion
			const workspaceIds: string[] = [];
			const workspaces: Workspace[] = [];
			const sessionIds: string[] = [];
			const codingAgentProcessIds: string[] = [];
			const devServerProcessIds: string[] = [];
			const workspaceScriptProcessIds: string[] = [];

			const workspacesPage = await ctx.repos.workspace.list(
				Workspace.ByTaskId(task.id),
				{
					limit: 10000,
				},
			);
			for (const ws of workspacesPage.items) {
				workspaceIds.push(ws.id);
				workspaces.push(ws);
				const sessions = await ctx.repos.session.list(
					Session.ByWorkspaceId(ws.id),
					{
						limit: 10000,
					},
				);
				for (const session of sessions.items) {
					sessionIds.push(session.id);

					// Collect coding agent process IDs
					const caProcesses = await ctx.repos.codingAgentProcess.list(
						CodingAgentProcess.BySessionId(session.id),
						{ limit: 10000 },
					);
					for (const proc of caProcesses.items) {
						codingAgentProcessIds.push(proc.id);
					}

					// Collect dev server process IDs
					const dsProcesses = await ctx.repos.devServerProcess.list(
						DevServerProcess.BySessionId(session.id),
						{ limit: 10000 },
					);
					for (const proc of dsProcesses.items) {
						devServerProcessIds.push(proc.id);
					}

					// Collect workspace script process IDs
					const wsProcesses = await ctx.repos.workspaceScriptProcess.list(
						WorkspaceScriptProcess.BySessionId(session.id),
						{ limit: 10000 },
					);
					for (const proc of wsProcesses.items) {
						workspaceScriptProcessIds.push(proc.id);
					}
				}
			}

			return {
				task,
				project,
				workspaceIds,
				workspaces,
				sessionIds,
				codingAgentProcessIds,
				devServerProcessIds,
				workspaceScriptProcessIds,
			};
		},

		write: async (
			ctx,
			{
				task,
				project,
				workspaces,
				workspaceIds,
				sessionIds,
				codingAgentProcessIds,
				devServerProcessIds,
				workspaceScriptProcessIds,
			},
		) => {
			// Delete dependent entities in reverse dependency order
			await executeCascadeDeletion(ctx, {
				codingAgentProcessIds,
				devServerProcessIds,
				workspaceScriptProcessIds,
				sessionIds,
				workspaceIds,
			});

			// 5. workspaces (depend on tasks)
			await ctx.repos.workspace.delete(Workspace.ByTaskId(task.id));

			// 6. task
			await ctx.repos.task.delete(Task.ById(task.id));

			return { deleted: true, taskId: task.id, workspaces, project };
		},

		post: async (ctx, { workspaces, project }) => {
			if (!options?.deleteWorktrees) {
				return { deleted: true, taskId };
			}

			for (const ws of workspaces) {
				try {
					const worktreePath = ctx.repos.worktree.getWorktreePath(
						ws.id,
						project.name,
					);
					const exists = await ctx.repos.worktree.worktreeExists(
						ws.id,
						project.name,
					);
					if (exists) {
						await runCleanupIfConfigured(ctx.repos, ctx.logger, worktreePath);
					}
					await ctx.repos.worktree.removeAllWorktrees(ws.id, [project], true);
				} catch (error: unknown) {
					const message =
						error instanceof Error ? error.message : String(error);
					ctx.logger.error(
						`Failed to remove worktrees for workspace ${ws.id}: ${message}`,
						error,
					);
				}
			}

			return { deleted: true, taskId };
		},
	});
