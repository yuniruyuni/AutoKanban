import { fail } from "../../models/common";
import { Project } from "../../models/project";
import { Workspace } from "../../models/workspace";
import { usecase } from "../runner";

export const getDiffs = (
	workspaceId: string,
	projectId: string,
	baseCommit?: string,
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

			// Get target branch for base commit if not specified
			let resolvedBaseCommit = baseCommit;
			if (!resolvedBaseCommit) {
				const workspaceRepos = await ctx.repos.workspaceRepo.listByWorkspace(
					workspace.id,
				);
				const workspaceRepo = workspaceRepos.find(
					(wr) => wr.projectId === projectId,
				);
				resolvedBaseCommit = workspaceRepo?.targetBranch ?? project.branch;
			}

			return { workspace, project, baseCommit: resolvedBaseCommit };
		},

		post: async (ctx, { workspace, project, baseCommit }) => {
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

			// Get diffs
			const diffs = await ctx.repos.git.getDiffs(worktreePath, baseCommit);

			const totalAdditions = diffs.reduce((sum, d) => sum + d.additions, 0);
			const totalDeletions = diffs.reduce((sum, d) => sum + d.deletions, 0);

			return {
				diffs,
				totalAdditions,
				totalDeletions,
			};
		},
	});
