import { z } from "zod";
import { abortRebase } from "../../usecases/git/abort-rebase";
import { continueRebase } from "../../usecases/git/continue-rebase";
import { createPullRequest } from "../../usecases/git/create-pull-request";
import { finalizePrMerge } from "../../usecases/git/finalize-pr-merge";
import { getBranchStatus } from "../../usecases/git/get-branch-status";
import { getDiffs } from "../../usecases/git/get-diffs";
import { getFileDiff } from "../../usecases/git/get-file-diff";
import { listBranches } from "../../usecases/git/list-branches";
import { mergeBranch } from "../../usecases/git/merge-branch";
import { pushBranch } from "../../usecases/git/push-branch";
import { rebaseBranch } from "../../usecases/git/rebase-branch";
import { handleResult } from "../handle-result";
import { publicProcedure, router } from "../trpc";

export const gitRouter = router({
	// List branches
	listBranches: publicProcedure
		.input(z.object({ projectId: z.string().uuid() }))
		.query(async ({ ctx, input }) =>
			handleResult(await listBranches(input).run(ctx)),
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
			handleResult(await getBranchStatus(input).run(ctx)),
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
			handleResult(await getDiffs(input).run(ctx)),
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
			handleResult(await getFileDiff(input).run(ctx)),
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
			handleResult(await rebaseBranch(input).run(ctx)),
		),

	abortRebase: publicProcedure
		.input(
			z.object({
				workspaceId: z.string().uuid(),
				projectId: z.string().uuid(),
			}),
		)
		.mutation(async ({ ctx, input }) =>
			handleResult(await abortRebase(input).run(ctx)),
		),

	continueRebase: publicProcedure
		.input(
			z.object({
				workspaceId: z.string().uuid(),
				projectId: z.string().uuid(),
			}),
		)
		.mutation(async ({ ctx, input }) =>
			handleResult(await continueRebase(input).run(ctx)),
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
			handleResult(await mergeBranch(input).run(ctx)),
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
			handleResult(await pushBranch(input).run(ctx)),
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
			handleResult(await createPullRequest(input).run(ctx)),
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
			handleResult(await finalizePrMerge(input).run(ctx)),
		),
});
