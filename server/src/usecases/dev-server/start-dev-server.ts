import { fail } from "../../models/common";
import { ExecutionProcess } from "../../models/execution-process";
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
		read: (ctx) => {
			// Get task
			const task = ctx.repos.task.get(Task.ById(input.taskId));
			if (!task) {
				return fail("NOT_FOUND", "Task not found", {
					taskId: input.taskId,
				});
			}

			// Get project
			const project = ctx.repos.project.get(Project.ById(task.projectId));
			if (!project) {
				return fail("NOT_FOUND", "Project not found", {
					projectId: task.projectId,
				});
			}

			if (!project.devServerScript) {
				return fail("INVALID_STATE", "Project has no dev server script");
			}

			// Find active workspace
			const workspace = ctx.repos.workspace.get(
				Workspace.ByTaskIdActive(input.taskId),
			);
			if (!workspace) {
				return fail("NOT_FOUND", "No active workspace for task");
			}

			if (!workspace.worktreePath) {
				return fail("INVALID_STATE", "Workspace has no worktree path");
			}

			// Resolve actual repo path inside worktree
			// workspace.worktreePath is the workspace dir (e.g. .../worktrees/{id}),
			// the actual repo is at .../worktrees/{id}/{projectName}
			const worktreePath = ctx.repos.worktree.getWorktreePath(
				workspace.id,
				project.name,
			);

			// Find latest session
			const sessionPage = ctx.repos.session.list(
				Session.ByWorkspaceId(workspace.id),
				{ limit: 1, sort: { keys: ["createdAt", "id"], order: "desc" } },
			);
			if (sessionPage.items.length === 0) {
				return fail("NOT_FOUND", "No session found for workspace");
			}
			const session = sessionPage.items[0];

			// Check for existing running dev server in this session
			const existingPage = ctx.repos.executionProcess.list(
				ExecutionProcess.BySessionId(session.id)
					.and(ExecutionProcess.ByRunReason("devserver"))
					.and(ExecutionProcess.ByStatus("running")),
				{ limit: 1, sort: ExecutionProcess.defaultSort },
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
				worktreePath,
			};
		},

		process: (_ctx, data) => {
			if (data.alreadyRunning) return data;
			const ep = ExecutionProcess.create({
				sessionId: data.session.id,
				runReason: "devserver",
			});
			return { ...data, executionProcess: ep };
		},

		write: (ctx, data) => {
			if (data.alreadyRunning) return data;
			ctx.repos.executionProcess.upsert(data.executionProcess);
			return data;
		},

		post: (ctx, data) => {
			if (data.alreadyRunning) return data;
			ctx.repos.devServer.start({
				processId: data.executionProcess.id,
				command: data.project.devServerScript!,
				workingDir: data.worktreePath,
			});
			return data;
		},

		result: (data) => ({
			executionProcessId: data.alreadyRunning
				? data.executionProcessId
				: data.executionProcess.id,
		}),
	});
