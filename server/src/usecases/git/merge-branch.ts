import { fail } from "../../models/common";
import { Project } from "../../models/project";
import { Task } from "../../models/task";
import { Workspace } from "../../models/workspace";
import { runCleanupIfConfigured } from "../run-cleanup-before-removal";
import { usecase } from "../runner";

export interface MergeBranchInput {
	workspaceId: string;
	projectId: string;
	targetBranch: string;
}

export const mergeBranch = (input: MergeBranchInput) =>
	usecase({
		read: async (ctx) => {
			const workspace = await ctx.repos.workspace.get(
				Workspace.ById(input.workspaceId),
			);
			if (!workspace) {
				return fail("NOT_FOUND", `Workspace not found: ${input.workspaceId}`);
			}

			const project = await ctx.repos.project.get(
				Project.ById(input.projectId),
			);
			if (!project) {
				return fail("NOT_FOUND", `Project not found: ${input.projectId}`);
			}

			const task = await ctx.repos.task.get(Task.ById(workspace.taskId));

			return { workspace, project, task };
		},

		process: (_ctx, { workspace, project, task }) => {
			const updatedTask = task ? Task.toDone(task) : null;
			return { workspace, project, updatedTask };
		},

		write: async (ctx, data) => {
			if (data.updatedTask) {
				await ctx.repos.task.upsert(data.updatedTask);
			}
			return data;
		},

		post: async (ctx, { workspace, project }) => {
			const worktreePath = ctx.repos.worktree.getWorktreePath(
				workspace.id,
				project.name,
			);

			const exists = await ctx.repos.worktree.worktreeExists(
				workspace.id,
				project.name,
			);

			if (!exists) {
				return fail("NOT_FOUND", "Worktree does not exist");
			}

			// Fast-forward merge
			try {
				await ctx.repos.git.fastForwardMerge(worktreePath, input.targetBranch);
			} catch (error) {
				if (
					error instanceof Error &&
					error.message === "FAST_FORWARD_NOT_POSSIBLE"
				) {
					return fail(
						"MERGE_FAILED",
						"Fast-forward merge not possible. Rebase first.",
					);
				}
				throw error;
			}

			// Run cleanup script before removing worktree
			await runCleanupIfConfigured(ctx.repos, ctx.logger, worktreePath);

			// Clean up worktree
			await ctx.repos.worktree.removeWorktree(workspace.id, project);

			return { success: true };
		},
	});
