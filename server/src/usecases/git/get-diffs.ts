import { fail } from "../../models/common";
import type { GitDiff } from "../../models/git-diff";
import { Project } from "../../models/project";
import { Workspace } from "../../models/workspace";
import { usecase } from "../runner";

export interface GetDiffsInput {
	workspaceId: string;
	projectId: string;
	baseCommit?: string; // Defaults to target branch
}

export interface GetDiffsResult {
	diffs: GitDiff[];
	totalAdditions: number;
	totalDeletions: number;
}

export const getDiffs = (input: GetDiffsInput) =>
	usecase({
		read: async (ctx) => {
			const workspace = ctx.repos.workspace.get(
				Workspace.ById(input.workspaceId),
			);
			if (!workspace) {
				return fail("NOT_FOUND", `Workspace not found: ${input.workspaceId}`);
			}

			const project = ctx.repos.project.get(Project.ById(input.projectId));
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

			// Get target branch for base commit if not specified
			let baseCommit = input.baseCommit;
			if (!baseCommit) {
				const workspaceRepo = ctx.repos.workspaceRepo
					.listByWorkspace(workspace.id)
					.find((wr) => wr.projectId === input.projectId);
				baseCommit = workspaceRepo?.targetBranch ?? project.branch;
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
