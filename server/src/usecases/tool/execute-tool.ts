// @specre 01KPNSJ3RX9X81V6FS6GB9G86R
import { fail } from "../../models/common";
import { Project } from "../../models/project";
import { Task } from "../../models/task";
import { Tool } from "../../models/tool";
import { Workspace } from "../../models/workspace";
import { usecase } from "../runner";

export const executeTool = (
	toolId: string,
	context?: { taskId?: string; projectId?: string },
) =>
	usecase({
		pre: async () => {
			if (!context?.taskId && !context?.projectId) {
				return fail(
					"INVALID_INPUT",
					"Either taskId or projectId must be provided",
				);
			}
			return {};
		},

		read: async (ctx) => {
			const tool = await ctx.repos.tool.get(Tool.ById(toolId));
			if (!tool) {
				return fail("NOT_FOUND", "Tool not found", { toolId });
			}

			// Gather DB data needed to determine the path
			let project: Project | null = null;
			let workspaceId: string | null = null;
			let targetPath: string | null = null;

			if (context?.taskId) {
				const task = await ctx.repos.task.get(Task.ById(context.taskId));
				if (!task) {
					return fail("NOT_FOUND", "Task not found", {
						taskId: context.taskId,
					});
				}

				project = await ctx.repos.project.get(Project.ById(task.projectId));
				if (!project) {
					return fail("NOT_FOUND", "Project not found", {
						projectId: task.projectId,
					});
				}

				const workspace = await ctx.repos.workspace.get(
					Workspace.ByTaskIdActive(context.taskId),
				);
				if (workspace) {
					workspaceId = workspace.id;
				} else {
					targetPath = project.repoPath;
				}
			} else if (context?.projectId) {
				project = await ctx.repos.project.get(Project.ById(context.projectId));
				if (!project) {
					return fail("NOT_FOUND", "Project not found", {
						projectId: context.projectId,
					});
				}
				targetPath = project.repoPath;
			}

			return { tool, project, workspaceId, targetPath };
		},

		process: (_, { tool, project, workspaceId, targetPath }) => {
			return {
				tool,
				projectName: project?.name ?? null,
				workspaceId,
				targetPath,
			};
		},

		post: async (ctx, { tool, projectName, workspaceId, targetPath }) => {
			// Resolve worktree path (External call) if needed
			let path = targetPath;
			if (workspaceId && projectName) {
				path = ctx.repos.worktree.getWorktreePath(workspaceId, projectName);
			}

			const finalPath = path ?? "";
			const command = tool.command.replace(/\{path\}/g, finalPath);

			if (!command.trim()) {
				return fail("INVALID_COMMAND", "Command is empty");
			}

			try {
				await ctx.repos.tool.executeCommand(command, finalPath || undefined);
				return { success: true, command };
			} catch (error) {
				return fail("EXECUTION_ERROR", `Failed to execute command: ${error}`);
			}
		},
	});
