import { fail } from "../../models/common";
import { Project } from "../../models/project";
import { Workspace } from "../../models/workspace";
import { usecase } from "../runner";

export const getBranchStatus = (workspaceId: string, projectId: string) =>
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

			const workspaceRepos = await ctx.repos.workspaceRepo.listByWorkspace(
				workspace.id,
			);
			const workspaceRepo = workspaceRepos.find(
				(wr) => wr.projectId === projectId,
			);

			const targetBranch = workspaceRepo?.targetBranch ?? project.branch;
			const prUrl = workspaceRepo?.prUrl ?? null;

			return { workspace, project, targetBranch, prUrl };
		},

		post: async (ctx, { workspace, project, targetBranch, prUrl }) => {
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
			const status = await ctx.repos.git.getBranchStatus(
				worktreePath,
				targetBranch,
			);

			// Enrich with PR status if available
			let prState: "open" | "closed" | "merged" | null = null;
			if (prUrl) {
				try {
					const pr = await ctx.repos.git.getPrStatus(project.repoPath, prUrl);
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
