import { Approval } from "../../models/approval";
import { CodingAgentProcess } from "../../models/coding-agent-process";
import { CodingAgentTurn } from "../../models/coding-agent-turn";
import { fail } from "../../models/common";
import { DevServerProcess } from "../../models/dev-server-process";
import { Project } from "../../models/project";
import { Session } from "../../models/session";
import { Task } from "../../models/task";
import { Workspace } from "../../models/workspace";
import { WorkspaceRepo } from "../../models/workspace-repo";
import { WorkspaceScriptProcess } from "../../models/workspace-script-process";
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
			// Delete in reverse dependency order

			// 1. approvals & coding_agent_turns & coding_agent_process_logs
			for (const epId of codingAgentProcessIds) {
				await ctx.repos.approval.delete(Approval.ByExecutionProcessId(epId));
				await ctx.repos.codingAgentTurn.delete(
					CodingAgentTurn.ByExecutionProcessId(epId),
				);
				await ctx.repos.codingAgentProcessLogs.deleteLogs(epId);
			}

			// 1b. dev server process logs
			for (const epId of devServerProcessIds) {
				await ctx.repos.devServerProcessLogs.deleteLogs(epId);
			}

			// 1c. workspace script process logs
			for (const epId of workspaceScriptProcessIds) {
				await ctx.repos.workspaceScriptProcessLogs.deleteLogs(epId);
			}

			// 2. processes (depend on sessions)
			for (const sessionId of sessionIds) {
				await ctx.repos.codingAgentProcess.delete(
					CodingAgentProcess.BySessionId(sessionId),
				);
				await ctx.repos.devServerProcess.delete(
					DevServerProcess.BySessionId(sessionId),
				);
				await ctx.repos.workspaceScriptProcess.delete(
					WorkspaceScriptProcess.BySessionId(sessionId),
				);
			}

			// 3. sessions (depend on workspaces)
			for (const wsId of workspaceIds) {
				await ctx.repos.session.delete(Session.ByWorkspaceId(wsId));
			}

			// 4. workspace_repos (depend on workspaces and projects)
			for (const wsId of workspaceIds) {
				await ctx.repos.workspaceRepo.delete(WorkspaceRepo.ByWorkspaceId(wsId));
			}
			await ctx.repos.workspaceRepo.delete(
				WorkspaceRepo.ByProjectId(project.id),
			);

			// 5. workspaces (depend on tasks)
			for (const taskId of taskIds) {
				await ctx.repos.workspace.delete(Workspace.ByTaskId(taskId));
			}

			// 6. tasks (depend on project)
			await ctx.repos.task.delete(Task.ByProject(project.id));

			// 7. project
			await ctx.repos.project.delete(Project.ById(project.id));

			return { deleted: true, projectId: project.id, workspaceIds, project };
		},

		post: async (ctx, { workspaceIds, project }) => {
			if (!input.deleteWorktrees) {
				return { deleted: true, projectId: project.id };
			}

			for (const wsId of workspaceIds) {
				try {
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
