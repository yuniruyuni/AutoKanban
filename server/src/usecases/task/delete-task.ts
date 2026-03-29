import { Approval } from "../../models/approval";
import { CodingAgentTurn } from "../../models/coding-agent-turn";
import { fail } from "../../models/common";
import { ExecutionProcess } from "../../models/execution-process";
import { Session } from "../../models/session";
import { Task } from "../../models/task";
import { Workspace } from "../../models/workspace";
import { WorkspaceRepo } from "../../models/workspace-repo";
import { usecase } from "../runner";

export interface DeleteTaskInput {
	taskId: string;
}

export const deleteTask = (input: DeleteTaskInput) =>
	usecase({
		read: async (ctx) => {
			const task = await ctx.repos.task.get(Task.ById(input.taskId));
			if (!task) {
				return fail("NOT_FOUND", "Task not found", { taskId: input.taskId });
			}

			// Collect all related entity IDs for cascade deletion
			const workspaceIds: string[] = [];
			const sessionIds: string[] = [];
			const executionProcessIds: string[] = [];

			const workspaces = await ctx.repos.workspace.list(
				Workspace.ByTaskId(task.id),
				{
					limit: 10000,
				},
			);
			for (const ws of workspaces.items) {
				workspaceIds.push(ws.id);
				const sessions = await ctx.repos.session.list(
					Session.ByWorkspaceId(ws.id),
					{
						limit: 10000,
					},
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

			return { task, workspaceIds, sessionIds, executionProcessIds };
		},

		write: async (
			ctx,
			{ task, workspaceIds, sessionIds, executionProcessIds },
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

			// 4. workspace_repos (depend on workspaces)
			for (const wsId of workspaceIds) {
				await ctx.repos.workspaceRepo.delete(WorkspaceRepo.ByWorkspaceId(wsId));
			}

			// 5. workspaces (depend on tasks)
			await ctx.repos.workspace.delete(Workspace.ByTaskId(task.id));

			// 6. task
			await ctx.repos.task.delete(Task.ById(task.id));

			return { deleted: true, taskId: task.id };
		},
	});
