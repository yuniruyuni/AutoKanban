import { fail } from "../../models/common";
import { Variant } from "../../models/variant";
import { usecase } from "../runner";

export interface DeleteVariantInput {
	variantId: string;
}

export const deleteVariant = (input: DeleteVariantInput) =>
	usecase({
		read: async (ctx) => {
			const variant = await ctx.repos.variant.get(
				Variant.ById(input.variantId),
			);
			if (!variant) {
				return fail("NOT_FOUND", "Variant not found", {
					variantId: input.variantId,
				});
			}
			return { variant };
		},

		write: async (ctx, { variant }) => {
			await ctx.repos.variant.delete(Variant.ById(variant.id));
			return { success: true };
		},
	});
