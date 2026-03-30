import { fail } from "../../models/common";
import { Project } from "../../models/project";
import { Workspace } from "../../models/workspace";
import { usecase } from "../runner";

export interface ContinueRebaseInput {
	workspaceId: string;
	projectId: string;
}

export const continueRebase = (input: ContinueRebaseInput) =>
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

			// Check if rebase is in progress
			const isRebaseInProgress =
				await ctx.repos.git.isRebaseInProgress(worktreePath);
			if (!isRebaseInProgress) {
				return fail("GIT_ERROR", "No rebase in progress");
			}

			// Check for remaining conflicts
			const conflictedFiles =
				await ctx.repos.git.getConflictedFiles(worktreePath);
			if (conflictedFiles.length > 0) {
				return fail(
					"GIT_ERROR",
					`Cannot continue rebase: conflicts remain in ${conflictedFiles.join(", ")}`,
				);
			}

			// Continue rebase
			try {
				await ctx.repos.git.continueRebase(worktreePath);
				return { success: true, hasConflicts: false };
			} catch (error) {
				if (error instanceof Error && error.message.includes("conflict")) {
					const files = await ctx.repos.git.getConflictedFiles(worktreePath);
					return { success: false, hasConflicts: true, conflictedFiles: files };
				}
				throw error;
			}
		},
	});
