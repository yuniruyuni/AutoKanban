import { fail } from "../../models/common";
import { ExecutionProcess } from "../../models/execution-process";
import { Project } from "../../models/project";
import { Session } from "../../models/session";
import { Task } from "../../models/task";
import { Workspace } from "../../models/workspace";
import { usecase } from "../runner";

export type WorkspaceScriptType = "prepare" | "cleanup";

export interface RunWorkspaceScriptInput {
	taskId: string;
	scriptType: WorkspaceScriptType;
}

const RUN_REASON_MAP = {
	prepare: "setupscript",
	cleanup: "cleanupscript",
} as const;

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

			const worktreePath = ctx.repos.worktree.getWorktreePath(
				workspace.id,
				project.name,
			);

			const config = await ctx.repos.workspaceConfig.load(worktreePath);
			const command = config[input.scriptType];
			if (!command) {
				return fail(
					"INVALID_STATE",
					`No ${input.scriptType} script in auto-kanban.json`,
				);
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
			const runningSetup = await ctx.repos.executionProcess.list(
				ExecutionProcess.BySessionId(session.id)
					.and(ExecutionProcess.ByRunReason("setupscript"))
					.and(ExecutionProcess.ByStatus("running")),
				{ limit: 1, sort: ExecutionProcess.defaultSort },
			);
			const runningCleanup = await ctx.repos.executionProcess.list(
				ExecutionProcess.BySessionId(session.id)
					.and(ExecutionProcess.ByRunReason("cleanupscript"))
					.and(ExecutionProcess.ByStatus("running")),
				{ limit: 1, sort: ExecutionProcess.defaultSort },
			);
			if (runningSetup.items.length > 0 || runningCleanup.items.length > 0) {
				return fail(
					"INVALID_STATE",
					"Another workspace script is already running",
				);
			}

			return { session, worktreePath, command };
		},

		process: (_ctx, data) => {
			const ep = ExecutionProcess.create({
				sessionId: data.session.id,
				runReason: RUN_REASON_MAP[input.scriptType],
			});
			return { ...data, executionProcess: ep };
		},

		write: async (ctx, data) => {
			await ctx.repos.executionProcess.upsert(data.executionProcess);
			return data;
		},

		post: (ctx, data) => {
			ctx.repos.devServer.start({
				processId: data.executionProcess.id,
				command: data.command,
				workingDir: data.worktreePath,
			});
			return data;
		},

		result: (data) => ({
			executionProcessId: data.executionProcess.id,
		}),
	});
