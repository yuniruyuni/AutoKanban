import { fail } from "../../models/common";
import { Project } from "../../models/project";
import { Workspace } from "../../models/workspace";
import { usecase } from "../runner";

export const abortRebase = (workspaceId: string, projectId: string) =>
	usecase({
		read: async (ctx) => {
			const workspace = await ctx.repos.workspace.get(
				Workspace.ById(workspaceId),
			);
			if (!workspace) {
				return fail("NOT_FOUND", `Workspace not found: ${workspaceId}`);
			}

			const project = await ctx.repos.project.get(Project.ById(projectId));
			if (!project) {
				return fail("NOT_FOUND", `Project not found: ${projectId}`);
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

			// Abort rebase
			await ctx.repos.git.abortRebase(worktreePath);

			return { success: true };
		},
	});
