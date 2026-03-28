import { fail } from "../../models/common";
import { Project } from "../../models/project";
import { Task } from "../../models/task";
import { Workspace } from "../../models/workspace";
import { usecase } from "../runner";

export interface FinalizePrMergeInput {
	workspaceId: string;
	projectId: string;
}

export const finalizePrMerge = (input: FinalizePrMergeInput) =>
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

			const task = ctx.repos.task.get(Task.ById(workspace.taskId));
			if (!task) {
				return fail("NOT_FOUND", `Task not found: ${workspace.taskId}`);
			}

			// Idempotency: if task is already done, nothing to do
			if (task.status === "done") {
				return { workspace, project, task, alreadyDone: true as const };
			}

			const workspaceRepo = ctx.repos.workspaceRepo
				.listByWorkspace(workspace.id)
				.find((wr) => wr.projectId === input.projectId);

			if (!workspaceRepo?.prUrl) {
				return fail("VALIDATION", "No PR URL found for this workspace repo");
			}

			// Verify PR is actually merged
			const pr = await ctx.repos.git.getPrStatus(
				project.repoPath,
				workspaceRepo.prUrl,
			);
			if (pr.state !== "merged") {
				return fail("VALIDATION", `PR is not merged (state: ${pr.state})`);
			}

			const targetBranch = workspaceRepo.targetBranch;

			return {
				workspace,
				project,
				task,
				targetBranch,
				alreadyDone: false as const,
			};
		},

		write: async (ctx, data) => {
			if (data.alreadyDone) {
				return { success: true };
			}

			const { project, task, targetBranch } = data;

			// Pull default branch
			await ctx.repos.git.pullBranch(project.repoPath, targetBranch);

			// Mark task as done
			ctx.repos.task.upsert({ ...task, status: "done", updatedAt: ctx.now });

			// Remove worktree
			await ctx.repos.worktree.removeWorktree(data.workspace.id, project);

			return { success: true };
		},
	});
