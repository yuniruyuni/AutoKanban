import { z } from "zod";
import { createTool } from "../../../usecases/tool/create-tool";
import { deleteTool } from "../../../usecases/tool/delete-tool";
import { executeTool } from "../../../usecases/tool/execute-tool";
import { listTools } from "../../../usecases/tool/list-tools";
import { updateTool } from "../../../usecases/tool/update-tool";
import { handleResult } from "../handle-result";
import { publicProcedure, router } from "../init";

export const toolRouter = router({
	list: publicProcedure.query(async ({ ctx }) =>
		handleResult(await listTools().run(ctx)),
	),

	create: publicProcedure
		.input(
			z.object({
				name: z.string().min(1),
				icon: z.string().min(1),
				iconColor: z.string().optional(),
				command: z.string().min(1),
				sortOrder: z.number().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) =>
			handleResult(await createTool(input).run(ctx)),
		),

	update: publicProcedure
		.input(
			z.object({
				toolId: z.string().uuid(),
				name: z.string().min(1).optional(),
				icon: z.string().min(1).optional(),
				iconColor: z.string().optional(),
				command: z.string().min(1).optional(),
				sortOrder: z.number().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) =>
			handleResult(await updateTool(input).run(ctx)),
		),

	delete: publicProcedure
		.input(z.object({ toolId: z.string().uuid() }))
		.mutation(async ({ ctx, input }) =>
			handleResult(await deleteTool(input).run(ctx)),
		),

	execute: publicProcedure
		.input(
			z
				.object({
					toolId: z.string().uuid(),
					taskId: z.string().uuid().optional(),
					projectId: z.string().uuid().optional(),
				})
				.refine((data) => data.taskId || data.projectId, {
					message: "Either taskId or projectId must be provided",
				}),
		)
		.mutation(async ({ ctx, input }) =>
			handleResult(await executeTool(input).run(ctx)),
		),
});
