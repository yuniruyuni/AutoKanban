import { fail } from "../../models/common";
import { Project } from "../../models/project";
import { Task } from "../../models/task";
import { Workspace } from "../../models/workspace";
import { runCleanupIfConfigured } from "../run-cleanup-before-removal";
import { usecase } from "../runner";

export interface FinalizePrMergeInput {
	workspaceId: string;
	projectId: string;
}

export const finalizePrMerge = (input: FinalizePrMergeInput) =>
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

			const task = await ctx.repos.task.get(Task.ById(workspace.taskId));
			if (!task) {
				return fail("NOT_FOUND", `Task not found: ${workspace.taskId}`);
			}

			// Idempotency: if task is already done, nothing to do
			if (task.status === "done") {
				return { workspace, project, task, alreadyDone: true as const };
			}

			const workspaceRepos = await ctx.repos.workspaceRepo.listByWorkspace(
				workspace.id,
			);
			const workspaceRepo = workspaceRepos.find(
				(wr) => wr.projectId === input.projectId,
			);

			if (!workspaceRepo?.prUrl) {
				return fail("VALIDATION", "No PR URL found for this workspace repo");
			}

			const targetBranch = workspaceRepo.targetBranch;
			const prUrl = workspaceRepo.prUrl;

			return {
				workspace,
				project,
				task,
				targetBranch,
				prUrl,
				alreadyDone: false as const,
			};
		},

		post: async (ctx, data) => {
			if (data.alreadyDone) {
				return { success: true, doneTask: null };
			}

			const { project, task, targetBranch, prUrl } = data;

			// Verify PR is actually merged
			const pr = await ctx.repos.git.getPrStatus(project.repoPath, prUrl);
			if (pr.state !== "merged") {
				return fail("VALIDATION", `PR is not merged (state: ${pr.state})`);
			}

			// Pull default branch
			await ctx.repos.git.pullBranch(project.repoPath, targetBranch);

			// Prepare task status update for finish step
			const doneTask = Task.toDone(task);

			// Run cleanup script before removing worktree
			const worktreePath = ctx.repos.worktree.getWorktreePath(
				data.workspace.id,
				project.name,
			);
			await runCleanupIfConfigured(ctx.repos, ctx.logger, worktreePath);

			// Remove worktree
			await ctx.repos.worktree.removeWorktree(data.workspace.id, project);

			return { success: true, doneTask: doneTask ?? null };
		},

		finish: async (ctx, { doneTask, ...result }) => {
			// Persist task status change in a new DB transaction
			if (doneTask) {
				await ctx.repos.task.upsert(doneTask);
			}
			return result;
		},
	});
