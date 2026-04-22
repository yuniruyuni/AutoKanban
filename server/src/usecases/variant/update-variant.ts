import { fail } from "../../models/common";
import { Variant } from "../../models/variant";
import { usecase } from "../runner";

export const updateVariant = (
	variantId: string,
	fields: Variant.UpdateFields,
) =>
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

		process: (ctx, { variant }) => {
			const updated = Variant.applyUpdate(variant, fields, ctx.now);
			return { variant: updated };
		},

		write: async (ctx, { variant }) => {
			await ctx.repos.variant.upsert(variant);
			return variant;
		},
	});
