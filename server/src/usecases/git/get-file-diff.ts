import { fail } from "../../models/common";
import { Project } from "../../models/project";
import { Workspace } from "../../models/workspace";
import { usecase } from "../runner";

export const getFileDiff = (
	workspaceId: string,
	projectId: string,
	filePath: string,
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

			// Get base commit
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

		post: async (
			ctx,
			{ workspace, project, baseCommit: resolvedBaseCommit },
		) => {
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

			// Get file diff
			const diff = await ctx.repos.git.getFileDiff(
				worktreePath,
				resolvedBaseCommit,
				filePath,
			);

			return { diff };
		},

		result: ({ diff }) => diff,
	});
