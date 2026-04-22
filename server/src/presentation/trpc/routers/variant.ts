// @specre 01KPNTBSG1VTZH0VGAVST7EX29
import { z } from "zod";
import { Variant } from "../../../models/variant";
import { createVariant } from "../../../usecases/variant/create-variant";
import { deleteVariant } from "../../../usecases/variant/delete-variant";
import { listVariants } from "../../../usecases/variant/list-variants";
import { updateVariant } from "../../../usecases/variant/update-variant";
import { handleResult } from "../handle-result";
import { publicProcedure, router } from "../init";

export const variantRouter = router({
	list: publicProcedure
		.input(z.object({ executor: z.string().min(1) }))
		.query(async ({ ctx, input }) =>
			handleResult(await listVariants(input.executor).run(ctx)),
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
		.mutation(async ({ ctx, input }) => {
			const variant = Variant.create(input);
			return handleResult(await createVariant(variant).run(ctx));
		}),

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
		.mutation(async ({ ctx, input }) => {
			const { variantId, ...fields } = input;
			return handleResult(await updateVariant(variantId, fields).run(ctx));
		}),

	delete: publicProcedure
		.input(z.object({ variantId: z.string().uuid() }))
		.mutation(async ({ ctx, input }) =>
			handleResult(await deleteVariant(input.variantId).run(ctx)),
		),
});
