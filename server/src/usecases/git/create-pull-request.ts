import { fail } from "../../models/common";
import { Project } from "../../models/project";
import { Workspace } from "../../models/workspace";
import { WorkspaceRepo } from "../../models/workspace-repo";
import { usecase } from "../runner";

export interface CreatePullRequestInput {
	workspaceId: string;
	projectId: string;
	taskTitle: string;
	remote?: string;
	force?: boolean;
	draft?: boolean;
}

export const createPullRequest = (input: CreatePullRequestInput) =>
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

			const workspaceRepos = await ctx.repos.workspaceRepo.listByWorkspace(
				workspace.id,
			);
			const workspaceRepo = workspaceRepos.find(
				(wr) => wr.projectId === input.projectId,
			);

			const targetBranch = workspaceRepo?.targetBranch ?? project.branch;

			return {
				workspace,
				project,
				targetBranch,
				workspaceRepo,
			};
		},

		post: async (ctx, { workspace, project, targetBranch, workspaceRepo }) => {
			const worktreePath = ctx.repos.worktree.getWorktreePath(
				workspace.id,
				project.name,
			);

			const exists = await ctx.repos.worktree.worktreeExists(
				workspace.id,
				project.name,
			);

			if (!exists) {
				return fail("NOT_FOUND", "Worktree does not exist");
			}

			const branch = await ctx.repos.git.getCurrentBranch(worktreePath);

			// Stage and commit any uncommitted changes
			const diffs = await ctx.repos.git.getDiffs(worktreePath, targetBranch);
			if (diffs.length > 0) {
				const { ahead } = await ctx.repos.git.getAheadBehind(
					worktreePath,
					branch,
					targetBranch,
				);
				if (ahead === 0) {
					// All changes are uncommitted — commit them
					await ctx.repos.git.stageAll(worktreePath);
					await ctx.repos.git.commit(worktreePath, input.taskTitle);
				}
			}

			// Push
			await ctx.repos.git.push(
				worktreePath,
				input.remote ?? "origin",
				branch,
				input.force ?? false,
			);

			// Read DraftPullRequest from in-memory store for title/body
			const draft = ctx.repos.draftPullRequest.get(
				input.workspaceId,
				input.projectId,
			);
			const prTitle = draft?.title ?? input.taskTitle;
			const prBody = draft?.body ?? "";

			// Create PR with draft (or fallback) title and body
			const { url } = await ctx.repos.git.createPullRequest(
				worktreePath,
				prTitle,
				prBody,
				targetBranch,
				input.draft,
			);

			// Clean up the draft pull request from in-memory store
			ctx.repos.draftPullRequest.delete(input.workspaceId, input.projectId);

			// Prepare workspace repo update for finish step
			const workspaceRepoToUpdate =
				workspaceRepo ??
				WorkspaceRepo.create({
					workspaceId: workspace.id,
					projectId: project.id,
					targetBranch,
				});

			return {
				success: true,
				branch,
				prUrl: url,
				workspaceRepoToUpdate: {
					...workspaceRepoToUpdate,
					prUrl: url,
					updatedAt: ctx.now,
				},
			};
		},

		finish: async (ctx, { workspaceRepoToUpdate, ...result }) => {
			// Persist workspace repo PR URL in a new DB transaction
			await ctx.repos.workspaceRepo.upsert(workspaceRepoToUpdate);
			return result;
		},
	});
