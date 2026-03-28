import { fail } from "../../models/common";
import { Project } from "../../models/project";
import { Task } from "../../models/task";
import { Tool } from "../../models/tool";
import { Workspace } from "../../models/workspace";
import { usecase } from "../runner";

export interface ExecuteToolInput {
	toolId: string;
	taskId?: string; // Task level: uses worktree path (workspace/{projectName})
	projectId?: string; // Project level: uses project.repoPath
}

export const executeTool = (input: ExecuteToolInput) =>
	usecase({
		read: (ctx) => {
			if (!input.taskId && !input.projectId) {
				return fail(
					"INVALID_INPUT",
					"Either taskId or projectId must be provided",
				);
			}

			const tool = ctx.repos.tool.get(Tool.ById(input.toolId));
			if (!tool) {
				return fail("NOT_FOUND", "Tool not found", { toolId: input.toolId });
			}

			// Determine the path based on taskId or projectId
			let targetPath: string | null = null;

			if (input.taskId) {
				// Get task to find the project
				const task = ctx.repos.task.get(Task.ById(input.taskId));
				if (!task) {
					return fail("NOT_FOUND", "Task not found", { taskId: input.taskId });
				}

				// Get project to get project name
				const project = ctx.repos.project.get(Project.ById(task.projectId));
				if (!project) {
					return fail("NOT_FOUND", "Project not found", {
						projectId: task.projectId,
					});
				}

				// Get workspace to get workspaceId
				const workspace = ctx.repos.workspace.get(
					Workspace.ByTaskIdActive(input.taskId),
				);
				if (workspace) {
					// Use the actual worktree path: {workspaceDir}/{projectName}
					targetPath = ctx.repos.worktree.getWorktreePath(
						workspace.id,
						project.name,
					);
				} else {
					// Fallback to project repoPath when no workspace exists yet
					targetPath = project.repoPath;
				}
			} else if (input.projectId) {
				const project = ctx.repos.project.get(Project.ById(input.projectId));
				if (!project) {
					return fail("NOT_FOUND", "Project not found", {
						projectId: input.projectId,
					});
				}
				targetPath = project.repoPath;
			}

			return { tool, targetPath };
		},

		process: (_, { tool, targetPath }) => {
			// Get the path - fallback to empty string if not available
			const path = targetPath ?? "";

			// Replace {path} placeholder with actual path
			const command = tool.command.replace(/\{path\}/g, path);

			return { command, path };
		},

		write: async (ctx, { command, path }) => {
			if (!command.trim()) {
				return fail("INVALID_COMMAND", "Command is empty");
			}

			try {
				ctx.repos.tool.executeCommand(command, path || undefined);

				return { success: true, command };
			} catch (error) {
				return fail("EXECUTION_ERROR", `Failed to execute command: ${error}`);
			}
		},
	});
