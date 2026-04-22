import { z } from "zod";
import { findWorkspaceByPath } from "../../../usecases/workspace/find-workspace-by-path";
import { getAttemptExecution } from "../../../usecases/workspace/get-attempt-execution";
import { listAttempts } from "../../../usecases/workspace/list-attempts";
import { handleResult } from "../handle-result";
import { publicProcedure, router } from "../init";

export const workspaceRouter = router({
	findByPath: publicProcedure
		.input(z.object({ worktreePath: z.string() }))
		.query(async ({ ctx, input }) =>
			handleResult(await findWorkspaceByPath(input.worktreePath).run(ctx)),
		),

	listAttempts: publicProcedure
		.input(z.object({ taskId: z.string() }))
		.query(async ({ ctx, input }) =>
			handleResult(await listAttempts(input.taskId).run(ctx)),
		),

	getAttemptExecution: publicProcedure
		.input(z.object({ workspaceId: z.string() }))
		.query(async ({ ctx, input }) =>
			handleResult(await getAttemptExecution(input.workspaceId).run(ctx)),
		),
});
