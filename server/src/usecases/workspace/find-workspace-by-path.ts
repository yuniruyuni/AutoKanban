import { type Fail, fail } from "../../models/common";
import { Project } from "../../models/project";
import { Task } from "../../models/task";
import type { Workspace } from "../../models/workspace";
import { usecase } from "../runner";

export interface FindWorkspaceByPathInput {
	worktreePath: string;
}

export interface WorkspaceContext {
	workspace: Workspace;
	task: Task;
	project: Project;
}

export const findWorkspaceByPath = (input: FindWorkspaceByPathInput) =>
	usecase({
		read: async (ctx): Promise<WorkspaceContext | Fail> => {
			const workspace = await ctx.repos.workspace.findByWorktreePath(
				input.worktreePath,
			);
			if (!workspace) {
				return fail("NOT_FOUND", "No workspace found for this path", {
					worktreePath: input.worktreePath,
				});
			}

			const task = await ctx.repos.task.get(Task.ById(workspace.taskId));
			if (!task) {
				return fail("NOT_FOUND", "Task not found for workspace", {
					taskId: workspace.taskId,
				});
			}

			const project = await ctx.repos.project.get(Project.ById(task.projectId));
			if (!project) {
				return fail("NOT_FOUND", "Project not found for task", {
					projectId: task.projectId,
				});
			}

			return { workspace, task, project };
		},
	});
