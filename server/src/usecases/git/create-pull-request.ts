import { fail } from "../../models/common";
import { Project } from "../../models/project";
import { Workspace } from "../../models/workspace";
import { WorkspaceRepo } from "../../models/workspace-repo";
import type { PostContext } from "../context";
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

			// Generate PR description via CodingAgent (session fork)
			const description = await generatePrDescription(ctx, {
				workspaceId: workspace.id,
				worktreePath,
			});
			const prTitle = description?.title ?? input.taskTitle;
			const prBody = description?.body ?? "";

			// Create PR with generated (or fallback) title and body
			const { url } = await ctx.repos.git.createPullRequest(
				worktreePath,
				prTitle,
				prBody,
				targetBranch,
				input.draft,
			);

			// Save PR URL to workspace repo
			const workspaceRepoToUpdate =
				workspaceRepo ??
				WorkspaceRepo.create({
					workspaceId: workspace.id,
					projectId: project.id,
					targetBranch,
				});
			await ctx.repos.workspaceRepo.upsert({
				...workspaceRepoToUpdate,
				prUrl: url,
				updatedAt: ctx.now,
			});

			return { success: true, branch, prUrl: url };
		},
	});

// ============================================
// PR description generation helper
// ============================================

const PR_DESCRIPTION_PROMPT = `Analyze the changes in this branch compared to the base branch and generate a Pull Request title and description.

The title should be concise and summarize the changes.
The body should be detailed markdown explaining what changed and why.`;

const PR_DESCRIPTION_SCHEMA = {
	type: "object",
	properties: {
		title: {
			type: "string",
			description: "Concise PR title summarizing the changes",
		},
		body: {
			type: "string",
			description:
				"Detailed PR body in markdown explaining what changed and why",
		},
	},
	required: ["title", "body"],
};

async function generatePrDescription(
	ctx: PostContext,
	params: {
		workspaceId: string;
		worktreePath: string;
	},
): Promise<{ title: string; body: string } | null> {
	const resumeInfo =
		await ctx.repos.codingAgentTurn.findLatestResumeInfoByWorkspaceId(
			params.workspaceId,
		);

	try {
		return (await ctx.repos.executor.runStructured(undefined, {
			workingDir: params.worktreePath,
			prompt: PR_DESCRIPTION_PROMPT,
			schema: PR_DESCRIPTION_SCHEMA,
			resumeSessionId: resumeInfo?.agentSessionId ?? undefined,
		})) as { title: string; body: string } | null;
	} catch (error) {
		ctx.logger.warn("Failed to generate PR description", error);
		return null;
	}
}
