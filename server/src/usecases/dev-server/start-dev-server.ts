// @specre 01KPNSJ3RRYH45YHGMS83W76H0
import { fail } from "../../models/common";
import { DevServerProcess } from "../../models/dev-server-process";
import { Project } from "../../models/project";
import { Session } from "../../models/session";
import { Task } from "../../models/task";
import { Workspace } from "../../models/workspace";
import { usecase } from "../runner";

export interface StartDevServerInput {
	taskId: string;
}

export const startDevServer = (input: StartDevServerInput) =>
	usecase({
		read: async (ctx) => {
			// Get task
			const task = await ctx.repos.task.get(Task.ById(input.taskId));
			if (!task) {
				return fail("NOT_FOUND", "Task not found", {
					taskId: input.taskId,
				});
			}

			// Get project
			const project = await ctx.repos.project.get(Project.ById(task.projectId));
			if (!project) {
				return fail("NOT_FOUND", "Project not found", {
					projectId: task.projectId,
				});
			}

			// Find active workspace
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

			// Check for existing running dev server in this session
			const existingPage = await ctx.repos.devServerProcess.list(
				DevServerProcess.BySessionId(session.id).and(
					DevServerProcess.ByStatus("running"),
				),
				{ limit: 1, sort: DevServerProcess.defaultSort },
			);
			if (existingPage.items.length > 0) {
				// Already running, return existing
				return {
					alreadyRunning: true as const,
					executionProcessId: existingPage.items[0].id,
				};
			}

			return {
				alreadyRunning: false as const,
				session,
				workspace,
				project,
			};
		},

		process: (_ctx, data) => {
			if (data.alreadyRunning) return data;
			const devServerProcess = DevServerProcess.create({
				sessionId: data.session.id,
			});
			return { ...data, devServerProcess };
		},

		post: async (ctx, data) => {
			if (data.alreadyRunning) return data;

			// Resolve actual repo path inside worktree
			const worktreePath = ctx.repos.worktree.getWorktreePath(
				data.workspace.id,
				data.project.name,
			);

			const config = await ctx.repos.workspaceConfig.load(worktreePath);
			if (!config.server) {
				return fail("INVALID_STATE", "No server script in auto-kanban.json");
			}

			ctx.repos.devServer.start({
				processId: data.devServerProcess.id,
				sessionId: data.session.id,
				command: config.server,
				workingDir: worktreePath,
			});
			return { ...data, worktreePath, serverCommand: config.server };
		},

		finish: async (ctx, data) => {
			if (data.alreadyRunning) return data;
			await ctx.repos.devServerProcess.upsert(data.devServerProcess);
			return data;
		},

		result: (data) => ({
			executionProcessId: data.alreadyRunning
				? data.executionProcessId
				: data.devServerProcess.id,
		}),
	});
