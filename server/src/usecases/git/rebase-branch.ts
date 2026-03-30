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

			return { workspace, project };
		},

		post: async (ctx, { workspace, project }) => {
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

			// Fetch latest from remote if available (ignore errors for local-only repos)
			try {
				await ctx.repos.git.fetch(worktreePath);
			} catch {
				// No remote or fetch failed — proceed with local state
			}

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
