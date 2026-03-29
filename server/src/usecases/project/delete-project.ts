import { Approval } from "../../models/approval";
import { CodingAgentTurn } from "../../models/coding-agent-turn";
import { fail } from "../../models/common";
import { ExecutionProcess } from "../../models/execution-process";
import { Project } from "../../models/project";
import { Session } from "../../models/session";
import { Task } from "../../models/task";
import { Workspace } from "../../models/workspace";
import { WorkspaceRepo } from "../../models/workspace-repo";
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
			const executionProcessIds: string[] = [];

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
						const processes = await ctx.repos.executionProcess.list(
							ExecutionProcess.BySessionId(session.id),
							{ limit: 10000 },
						);
						for (const proc of processes.items) {
							executionProcessIds.push(proc.id);
						}
					}
				}
			}

			return {
				project,
				taskIds,
				workspaceIds,
				sessionIds,
				executionProcessIds,
			};
		},

		write: async (
			ctx,
			{ project, taskIds, workspaceIds, sessionIds, executionProcessIds },
		) => {
			// Delete in reverse dependency order

			// 1. approvals & coding_agent_turns & execution_process_logs (depend on execution_processes)
			for (const epId of executionProcessIds) {
				await ctx.repos.approval.delete(Approval.ByExecutionProcessId(epId));
				await ctx.repos.codingAgentTurn.delete(
					CodingAgentTurn.ByExecutionProcessId(epId),
				);
				await ctx.repos.executionProcessLogs.deleteLogs(epId);
			}

			// 2. execution_processes (depend on sessions)
			for (const sessionId of sessionIds) {
				await ctx.repos.executionProcess.delete(
					ExecutionProcess.BySessionId(sessionId),
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
