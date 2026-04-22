// @specre 01KPNSHJVXRAQGH9C3HBFX3X2F
import { CodingAgentProcess } from "../../models/coding-agent-process";
import { fail } from "../../models/common";
import { DevServerProcess } from "../../models/dev-server-process";
import { Project } from "../../models/project";
import { Session } from "../../models/session";
import { Task } from "../../models/task";
import { Workspace } from "../../models/workspace";
import { WorkspaceRepo } from "../../models/workspace-repo";
import { WorkspaceScriptProcess } from "../../models/workspace-script-process";
import { executeCascadeDeletion } from "../cascade-deletion";
import { runCleanupIfConfigured } from "../run-cleanup-before-removal";
import { usecase } from "../runner";

export interface DeleteProjectInput {
	projectId: string;
	deleteWorktrees?: boolean;
}

export const deleteProject = (input: DeleteProjectInput) =>
	usecase({
		read: async (ctx) => {
			const project = await ctx.repos.project.get(
				Project.ById(input.projectId),
			);
			if (!project) {
				return fail("NOT_FOUND", "Project not found", {
					projectId: input.projectId,
				});
			}

			// Collect all related entity IDs for cascade deletion
			const tasks = await ctx.repos.task.list(Task.ByProject(input.projectId), {
				limit: 10000,
			});
			const taskIds = tasks.items.map((t) => t.id);

			const workspaceIds: string[] = [];
			const sessionIds: string[] = [];
			const codingAgentProcessIds: string[] = [];
			const devServerProcessIds: string[] = [];
			const workspaceScriptProcessIds: string[] = [];

			for (const taskId of taskIds) {
				const workspaces = await ctx.repos.workspace.list(
					Workspace.ByTaskId(taskId),
					{ limit: 10000 },
				);
				for (const ws of workspaces.items) {
					workspaceIds.push(ws.id);
					const sessions = await ctx.repos.session.list(
						Session.ByWorkspaceId(ws.id),
						{ limit: 10000 },
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
			}

			return {
				project,
				taskIds,
				workspaceIds,
				sessionIds,
				codingAgentProcessIds,
				devServerProcessIds,
				workspaceScriptProcessIds,
			};
		},

		write: async (
			ctx,
			{
				project,
				taskIds,
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

			return { deleted: true, projectId: project.id, workspaceIds, project };
		},

		post: async (ctx, { workspaceIds, project }) => {
			if (!input.deleteWorktrees) {
				return { deleted: true, projectId: project.id };
			}

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
					await ctx.repos.worktree.removeAllWorktrees(wsId, [project], true);
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
					`Failed to prune worktrees for project ${project.name}:`,
					error,
				);
			}

			return { deleted: true, projectId: project.id };
		},
	});
