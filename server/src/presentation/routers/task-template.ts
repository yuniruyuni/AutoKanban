import { z } from "zod";
import { createTaskTemplate } from "../../usecases/task-template/create-task-template";
import { deleteTaskTemplate } from "../../usecases/task-template/delete-task-template";
import { listTaskTemplates } from "../../usecases/task-template/list-task-templates";
import { updateTaskTemplate } from "../../usecases/task-template/update-task-template";
import { handleResult } from "../handle-result";
import { publicProcedure, router } from "../trpc";

const conditionSchema = z.enum(["no_dev_server"]).nullable().optional();

export const taskTemplateRouter = router({
	list: publicProcedure.query(async ({ ctx }) =>
		handleResult(await listTaskTemplates().run(ctx)),
	),

	create: publicProcedure
		.input(
			z.object({
				title: z.string().min(1),
				description: z.string().optional().nullable(),
				condition: conditionSchema,
				sortOrder: z.number().int().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) =>
			handleResult(await createTaskTemplate(input).run(ctx)),
		),

	update: publicProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				title: z.string().min(1).optional(),
				description: z.string().optional().nullable(),
				condition: conditionSchema,
				sortOrder: z.number().int().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) =>
			handleResult(await updateTaskTemplate(input).run(ctx)),
		),

	delete: publicProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) =>
			handleResult(await deleteTaskTemplate(input).run(ctx)),
		),
});
