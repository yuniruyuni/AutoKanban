import { fail } from "../../models/common";
import { Project } from "../../models/project";
import { Workspace } from "../../models/workspace";
import { usecase } from "../runner";

export interface GetFileDiffInput {
	workspaceId: string;
	projectId: string;
	filePath: string;
	baseCommit?: string;
}

export const getFileDiff = (input: GetFileDiffInput) =>
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

			// Get base commit
			let baseCommit = input.baseCommit;
			if (!baseCommit) {
				const workspaceRepos = await ctx.repos.workspaceRepo.listByWorkspace(
					workspace.id,
				);
				const workspaceRepo = workspaceRepos.find(
					(wr) => wr.projectId === input.projectId,
				);
				baseCommit = workspaceRepo?.targetBranch ?? project.branch;
			}

			// Get file diff
			const diff = await ctx.repos.git.getFileDiff(
				worktreePath,
				baseCommit,
				input.filePath,
			);

			return { diff };
		},

		result: ({ diff }) => diff,
	});
