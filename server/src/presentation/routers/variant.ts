import { z } from "zod";
import { createVariant } from "../../usecases/variant/create-variant";
import { deleteVariant } from "../../usecases/variant/delete-variant";
import { listVariants } from "../../usecases/variant/list-variants";
import { updateVariant } from "../../usecases/variant/update-variant";
import { handleResult } from "../handle-result";
import { publicProcedure, router } from "../trpc";

export const variantRouter = router({
	list: publicProcedure
		.input(z.object({ executor: z.string().min(1) }))
		.query(async ({ ctx, input }) =>
			handleResult(await listVariants(input).run(ctx)),
		),

	create: publicProcedure
		.input(
			z.object({
				executor: z.string().min(1),
				name: z.string().min(1),
				permissionMode: z.string().optional(),
				model: z.string().nullable().optional(),
				appendPrompt: z.string().nullable().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) =>
			handleResult(await createVariant(input).run(ctx)),
		),

	update: publicProcedure
		.input(
			z.object({
				variantId: z.string().uuid(),
				name: z.string().min(1).optional(),
				permissionMode: z.string().optional(),
				model: z.string().nullable().optional(),
				appendPrompt: z.string().nullable().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) =>
			handleResult(await updateVariant(input).run(ctx)),
		),

	delete: publicProcedure
		.input(z.object({ variantId: z.string().uuid() }))
		.mutation(async ({ ctx, input }) =>
			handleResult(await deleteVariant(input).run(ctx)),
		),
});
