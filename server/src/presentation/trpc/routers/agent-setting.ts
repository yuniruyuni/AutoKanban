// @specre 01KPNTBSG330HN6YBQ2AHJZDW4
import { z } from "zod";
import { getAgentSetting } from "../../../usecases/agent-setting/get-agent-setting";
import { updateAgentSetting } from "../../../usecases/agent-setting/update-agent-setting";
import { handleResult } from "../handle-result";
import { publicProcedure, router } from "../init";

export const agentSettingRouter = router({
	get: publicProcedure
		.input(z.object({ agentId: z.string().min(1) }))
		.query(async ({ ctx, input }) =>
			handleResult(await getAgentSetting(input.agentId).run(ctx)),
		),

	update: publicProcedure
		.input(
			z.object({
				agentId: z.string().min(1),
				command: z.string().min(1),
			}),
		)
		.mutation(async ({ ctx, input }) =>
			handleResult(
				await updateAgentSetting(input.agentId, input.command).run(ctx),
			),
		),

	checkAvailability: publicProcedure
		.input(z.object({ command: z.string().min(1) }))
		.query(({ input }) => {
			const path = Bun.which(input.command);
			return {
				available: path !== null,
				path,
			};
		}),
});
