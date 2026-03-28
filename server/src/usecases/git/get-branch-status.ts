import { fail } from "../../models/common";
import { Project } from "../../models/project";
import { Workspace } from "../../models/workspace";
import { usecase } from "../runner";

export interface GetBranchStatusInput {
	workspaceId: string;
	projectId: string;
}

export const getBranchStatus = (input: GetBranchStatusInput) =>
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

			// Get branch status
			const workspaceRepo = ctx.repos.workspaceRepo
				.listByWorkspace(workspace.id)
				.find((wr) => wr.projectId === input.projectId);

			const targetBranch = workspaceRepo?.targetBranch ?? project.branch;
			const status = await ctx.repos.git.getBranchStatus(
				worktreePath,
				targetBranch,
			);

			// Enrich with PR status if available
			const prUrl = workspaceRepo?.prUrl ?? null;
			let prState: "open" | "closed" | "merged" | null = null;
			if (prUrl) {
				try {
					const pr = await ctx.repos.git.getPrStatus(
						project.repoPath,
						prUrl,
					);
					prState = pr.state;
				} catch {
					// PR status check failed — return null prState
				}
			}

			return { status, prUrl, prState };
		},

		result: ({ status, prUrl, prState }) => ({
			...status,
			prUrl,
			prState,
		}),
	});
