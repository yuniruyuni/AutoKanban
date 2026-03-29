import { fail } from "../../models/common";
import { Project } from "../../models/project";
import { Workspace } from "../../models/workspace";
import { usecase } from "../runner";

export interface PushBranchInput {
	workspaceId: string;
	projectId: string;
	remote?: string;
	force?: boolean;
}

export const pushBranch = (input: PushBranchInput) =>
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

			// Get current branch
			const branch = await ctx.repos.git.getCurrentBranch(worktreePath);

			return { worktreePath, branch };
		},

		write: async (ctx, { worktreePath, branch }) => {
			// Push
			await ctx.repos.git.push(
				worktreePath,
				input.remote ?? "origin",
				branch,
				input.force ?? false,
			);

			return { success: true, branch };
		},
	});
