import { fail } from "../../models/common";
import { Project } from "../../models/project";
import { Workspace } from "../../models/workspace";
import { usecase } from "../runner";

export const pushBranch = (
	workspaceId: string,
	projectId: string,
	remote?: string,
	force?: boolean,
) =>
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

			// Check if worktree exists
			const exists = await ctx.repos.worktree.worktreeExists(
				workspace.id,
				project.name,
			);

			if (!exists) {
				return fail("NOT_FOUND", "Worktree does not exist");
			}

			// Get current branch
			const branch = await ctx.repos.git.getCurrentBranch(worktreePath);

			// Push
			await ctx.repos.git.push(
				worktreePath,
				remote ?? "origin",
				branch,
				force ?? false,
			);

			return { success: true, branch };
		},
	});
