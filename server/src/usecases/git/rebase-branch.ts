import { fail } from "../../models/common";
import { Project } from "../../models/project";
import { Workspace } from "../../models/workspace";
import { usecase } from "../runner";

export interface RebaseBranchInput {
	workspaceId: string;
	projectId: string;
	newBaseBranch: string;
}

export const rebaseBranch = (input: RebaseBranchInput) =>
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

			const worktreePath = ctx.repos.worktree.getWorktreePath(
				workspace.id,
				project.name,
			);

			// Check if worktree exists
			const exists = await ctx.repos.worktree.worktreeExists(
				workspace.id,
				project.name,
			);

			if (!exists) {
				return fail("NOT_FOUND", "Worktree does not exist");
			}

			return { worktreePath };
		},

		write: async (ctx, { worktreePath }) => {
			// Fetch latest from remote first
			await ctx.repos.git.fetch(worktreePath);

			// Perform rebase
			try {
				await ctx.repos.git.rebaseBranch(worktreePath, input.newBaseBranch);
				return { success: true, hasConflicts: false };
			} catch (error) {
				if (error instanceof Error && error.message === "REBASE_CONFLICT") {
					// Get conflicted files
					const conflictedFiles =
						await ctx.repos.git.getConflictedFiles(worktreePath);
					return { success: false, hasConflicts: true, conflictedFiles };
				}
				throw error;
			}
		},
	});
