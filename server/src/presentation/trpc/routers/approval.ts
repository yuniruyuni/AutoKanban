// @specre 01KPNSJ3R75HS06WT3HS01ZHAZ
import { z } from "zod";
import {
	getPendingApprovals,
	respondToApproval,
} from "../../../usecases/approval/respond-to-approval";
import { handleResult } from "../handle-result";
import { publicProcedure, router } from "../init";

export const approvalRouter = router({
	respond: publicProcedure
		.input(
			z.object({
				approvalId: z.string().uuid(),
				executionProcessId: z.string().uuid(),
				status: z.enum(["approved", "denied"]),
				reason: z.string().nullable().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) =>
			handleResult(
				await respondToApproval(
					input.approvalId,
					input.executionProcessId,
					input.status,
					input.reason,
				).run(ctx),
			),
		),

	getPending: publicProcedure
		.input(z.object({ executionProcessId: z.string().uuid() }))
		.query(async ({ ctx, input }) =>
			handleResult(
				await getPendingApprovals(input.executionProcessId).run(ctx),
			),
		),
});
