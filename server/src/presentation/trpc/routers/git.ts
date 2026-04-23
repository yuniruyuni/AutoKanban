import { z } from "zod";
import { abortRebase } from "../../../usecases/git/abort-rebase";
import { continueRebase } from "../../../usecases/git/continue-rebase";
import { createPullRequest } from "../../../usecases/git/create-pull-request";
import { finalizePrMerge } from "../../../usecases/git/finalize-pr-merge";
import { generatePrDescription } from "../../../usecases/git/generate-pr-description";
import { getBranchStatus } from "../../../usecases/git/get-branch-status";
import { getDiffs } from "../../../usecases/git/get-diffs";
import { getFileDiff } from "../../../usecases/git/get-file-diff";
import { listBranches } from "../../../usecases/git/list-branches";
import { mergeBranch } from "../../../usecases/git/merge-branch";
import { pushBranch } from "../../../usecases/git/push-branch";
import { rebaseBranch } from "../../../usecases/git/rebase-branch";
import { resolveRebaseConflict } from "../../../usecases/git/resolve-rebase-conflict";
import { handleResult } from "../handle-result";
import { publicProcedure, router } from "../init";

export const gitRouter = router({
	// List branches
	listBranches: publicProcedure
		.input(z.object({ projectId: z.string().uuid() }))
		.query(async ({ ctx, input }) =>
			handleResult(await listBranches(input.projectId).run(ctx)),
		),

	// Branch status
	getBranchStatus: publicProcedure
		.input(
			z.object({
				workspaceId: z.string().uuid(),
				projectId: z.string().uuid(),
			}),
		)
		.query(async ({ ctx, input }) =>
			handleResult(
				await getBranchStatus(input.workspaceId, input.projectId).run(ctx),
			),
		),

	// Diff operations
	getDiffs: publicProcedure
		.input(
			z.object({
				workspaceId: z.string().uuid(),
				projectId: z.string().uuid(),
				baseCommit: z.string().optional(),
			}),
		)
		.query(async ({ ctx, input }) =>
			handleResult(
				await getDiffs(
					input.workspaceId,
					input.projectId,
					input.baseCommit,
				).run(ctx),
			),
		),

	getFileDiff: publicProcedure
		.input(
			z.object({
				workspaceId: z.string().uuid(),
				projectId: z.string().uuid(),
				filePath: z.string(),
				baseCommit: z.string().optional(),
			}),
		)
		.query(async ({ ctx, input }) =>
			handleResult(
				await getFileDiff(
					input.workspaceId,
					input.projectId,
					input.filePath,
					input.baseCommit,
				).run(ctx),
			),
		),

	// Rebase operations
	rebase: publicProcedure
		.input(
			z.object({
				workspaceId: z.string().uuid(),
				projectId: z.string().uuid(),
				newBaseBranch: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) =>
			handleResult(
				await rebaseBranch(
					input.workspaceId,
					input.projectId,
					input.newBaseBranch,
				).run(ctx),
			),
		),

	abortRebase: publicProcedure
		.input(
			z.object({
				workspaceId: z.string().uuid(),
				projectId: z.string().uuid(),
			}),
		)
		.mutation(async ({ ctx, input }) =>
			handleResult(
				await abortRebase(input.workspaceId, input.projectId).run(ctx),
			),
		),

	continueRebase: publicProcedure
		.input(
			z.object({
				workspaceId: z.string().uuid(),
				projectId: z.string().uuid(),
			}),
		)
		.mutation(async ({ ctx, input }) =>
			handleResult(
				await continueRebase(input.workspaceId, input.projectId).run(ctx),
			),
		),

	// Spawn / message the Coding Agent to resolve an in-progress rebase
	// conflict. Typically chained by the client after `rebase` returns
	// `hasConflicts: true`.
	resolveRebaseConflict: publicProcedure
		.input(
			z.object({
				workspaceId: z.string().uuid(),
				projectId: z.string().uuid(),
			}),
		)
		.mutation(async ({ ctx, input }) =>
			handleResult(
				await resolveRebaseConflict(input.workspaceId, input.projectId).run(
					ctx,
				),
			),
		),

	// Merge operations
	merge: publicProcedure
		.input(
			z.object({
				workspaceId: z.string().uuid(),
				projectId: z.string().uuid(),
				targetBranch: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) =>
			handleResult(
				await mergeBranch(
					input.workspaceId,
					input.projectId,
					input.targetBranch,
				).run(ctx),
			),
		),

	// Push operations
	push: publicProcedure
		.input(
			z.object({
				workspaceId: z.string().uuid(),
				projectId: z.string().uuid(),
				remote: z.string().optional(),
				force: z.boolean().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) =>
			handleResult(
				await pushBranch(
					input.workspaceId,
					input.projectId,
					input.remote,
					input.force,
				).run(ctx),
			),
		),

	// PR operations
	createPR: publicProcedure
		.input(
			z.object({
				workspaceId: z.string().uuid(),
				projectId: z.string().uuid(),
				taskTitle: z.string(),
				remote: z.string().optional(),
				force: z.boolean().optional(),
				draft: z.boolean().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) =>
			handleResult(
				await createPullRequest(
					input.workspaceId,
					input.projectId,
					input.taskTitle,
					input.remote,
					input.force,
					input.draft,
				).run(ctx),
			),
		),

	// Finalize PR merge
	finalizePrMerge: publicProcedure
		.input(
			z.object({
				workspaceId: z.string().uuid(),
				projectId: z.string().uuid(),
			}),
		)
		.mutation(async ({ ctx, input }) =>
			handleResult(
				await finalizePrMerge(input.workspaceId, input.projectId).run(ctx),
			),
		),

	// Generate PR description (background, streamed via SSE)
	generatePRDescription: publicProcedure
		.input(
			z.object({
				workspaceId: z.string().uuid(),
				projectId: z.string().uuid(),
			}),
		)
		.mutation(async ({ ctx, input }) =>
			handleResult(
				await generatePrDescription(input.workspaceId, input.projectId).run(
					ctx,
				),
			),
		),
});
