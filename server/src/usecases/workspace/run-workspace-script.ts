// @specre 01KPNSJ3QC5W9HVHPA3PGSMZRF
import { fail } from "../../models/common";
import { Project } from "../../models/project";
import { Session } from "../../models/session";
import { Task } from "../../models/task";
import { Workspace } from "../../models/workspace";
import { WorkspaceScriptProcess } from "../../models/workspace-script-process";
import { usecase } from "../runner";

export type WorkspaceScriptType = "prepare" | "cleanup";

export interface RunWorkspaceScriptInput {
	taskId: string;
	scriptType: WorkspaceScriptType;
}

export const runWorkspaceScript = (input: RunWorkspaceScriptInput) =>
	usecase({
		read: async (ctx) => {
			const task = await ctx.repos.task.get(Task.ById(input.taskId));
			if (!task) {
				return fail("NOT_FOUND", "Task not found", { taskId: input.taskId });
			}

			const project = await ctx.repos.project.get(Project.ById(task.projectId));
			if (!project) {
				return fail("NOT_FOUND", "Project not found", {
					projectId: task.projectId,
				});
			}

			const workspace = await ctx.repos.workspace.get(
				Workspace.ByTaskIdActive(input.taskId),
			);
			if (!workspace) {
				return fail("NOT_FOUND", "No active workspace for task");
			}

			if (!workspace.worktreePath) {
				return fail("INVALID_STATE", "Workspace has no worktree path");
			}

			// Find latest session
			const sessionPage = await ctx.repos.session.list(
				Session.ByWorkspaceId(workspace.id),
				{ limit: 1, sort: { keys: ["createdAt", "id"], order: "desc" } },
			);
			if (sessionPage.items.length === 0) {
				return fail("NOT_FOUND", "No session found for workspace");
			}
			const session = sessionPage.items[0];

			// Check for already running workspace scripts (exclusive)
			const runningScripts = await ctx.repos.workspaceScriptProcess.list(
				WorkspaceScriptProcess.BySessionId(session.id).and(
					WorkspaceScriptProcess.ByStatus("running"),
				),
				{ limit: 1, sort: WorkspaceScriptProcess.defaultSort },
			);
			if (runningScripts.items.length > 0) {
				return fail(
					"INVALID_STATE",
					"Another workspace script is already running",
				);
			}

			return { session, workspace, projectName: project.name };
		},

		process: (_ctx, data) => {
			const workspaceScriptProcess = WorkspaceScriptProcess.create({
				sessionId: data.session.id,
				scriptType: input.scriptType,
			});
			return { ...data, workspaceScriptProcess };
		},

		post: async (ctx, data) => {
			// External calls: resolve worktree path and load workspace config
			const worktreePath = ctx.repos.worktree.getWorktreePath(
				data.workspace.id,
				data.projectName,
			);

			const config = await ctx.repos.workspaceConfig.load(worktreePath);
			const command = config[input.scriptType];
			if (!command) {
				return fail(
					"INVALID_STATE",
					`No ${input.scriptType} script in auto-kanban.json`,
				);
			}

			ctx.repos.devServer.start({
				processId: data.workspaceScriptProcess.id,
				sessionId: data.session.id,
				command,
				workingDir: worktreePath,
			});
			return { ...data, worktreePath, command };
		},

		finish: async (ctx, data) => {
			await ctx.repos.workspaceScriptProcess.upsert(
				data.workspaceScriptProcess,
			);
			return data;
		},

		result: (data) => ({
			executionProcessId: data.workspaceScriptProcess.id,
		}),
	});
