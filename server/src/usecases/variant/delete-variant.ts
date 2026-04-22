import { fail } from "../../models/common";
import { Variant } from "../../models/variant";
import { usecase } from "../runner";

export const deleteVariant = (variantId: string) =>
	usecase({
		read: async (ctx) => {
			const variant = await ctx.repos.variant.get(Variant.ById(variantId));
			if (!variant) {
				return fail("NOT_FOUND", "Variant not found", {
					variantId,
				});
			}
			return { variant };
		},

		write: async (ctx, { variant }) => {
			await ctx.repos.variant.delete(Variant.ById(variant.id));
			return { success: true };
		},
	});
