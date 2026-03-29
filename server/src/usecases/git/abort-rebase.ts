import { fail } from "../../models/common";
import { Project } from "../../models/project";
import { Workspace } from "../../models/workspace";
import { usecase } from "../runner";

export interface AbortRebaseInput {
	workspaceId: string;
	projectId: string;
}

export const abortRebase = (input: AbortRebaseInput) =>
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

			// Check if rebase is in progress
			const isRebaseInProgress =
				await ctx.repos.git.isRebaseInProgress(worktreePath);
			if (!isRebaseInProgress) {
				return fail("GIT_ERROR", "No rebase in progress");
			}

			return { worktreePath };
		},

		write: async (ctx, { worktreePath }) => {
			// Abort rebase
			await ctx.repos.git.abortRebase(worktreePath);

			return { success: true };
		},
	});
