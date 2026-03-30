import { z } from "zod";
import { getDevServer } from "../../../usecases/dev-server/get-dev-server";
import { startDevServer } from "../../../usecases/dev-server/start-dev-server";
import { stopDevServer } from "../../../usecases/dev-server/stop-dev-server";
import { handleResult } from "../handle-result";
import { publicProcedure, router } from "../init";

export const devServerRouter = router({
	start: publicProcedure
		.input(z.object({ taskId: z.string().uuid() }))
		.mutation(async ({ ctx, input }) =>
			handleResult(await startDevServer(input).run(ctx)),
		),

	stop: publicProcedure
		.input(z.object({ executionProcessId: z.string().uuid() }))
		.mutation(async ({ ctx, input }) =>
			handleResult(await stopDevServer(input).run(ctx)),
		),

	get: publicProcedure
		.input(z.object({ sessionId: z.string().uuid() }))
		.query(async ({ ctx, input }) =>
			handleResult(await getDevServer(input).run(ctx)),
		),
});
