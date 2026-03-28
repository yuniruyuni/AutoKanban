import { fail } from "../../models/common";
import { Project } from "../../models/project";
import { Task } from "../../models/task";
import { Workspace } from "../../models/workspace";
import { usecase } from "../runner";

export interface MergeBranchInput {
	workspaceId: string;
	projectId: string;
	targetBranch: string;
}

export const mergeBranch = (input: MergeBranchInput) =>
	usecase({
		read: async (ctx) => {
			const workspace = ctx.repos.workspace.get(
				Workspace.ById(input.workspaceId),
			);
			if (!workspace) {
				return fail("NOT_FOUND", `Workspace not found: ${input.workspaceId}`);
			}

			const project = ctx.repos.project.get(Project.ById(input.projectId));
			if (!project) {
				return fail("NOT_FOUND", `Project not found: ${input.projectId}`);
			}

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

			const task = ctx.repos.task.get(Task.ById(workspace.taskId));

			return { worktreePath, workspace, project, task };
		},

		write: async (ctx, { worktreePath, workspace, project, task }) => {
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

			// Merge succeeded → transition task to done
			if (task && task.status !== "done") {
				ctx.repos.task.upsert({
					...task,
					status: "done",
					updatedAt: ctx.now,
				});
			}

			// Clean up worktree
			await ctx.repos.worktree.removeWorktree(workspace.id, project);

			return { success: true };
		},
	});
