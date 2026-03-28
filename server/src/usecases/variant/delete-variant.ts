import { fail } from "../../models/common";
import { Variant } from "../../models/variant";
import { usecase } from "../runner";

export interface DeleteVariantInput {
	variantId: string;
}

export const deleteVariant = (input: DeleteVariantInput) =>
	usecase({
		read: (ctx) => {
			const variant = ctx.repos.variant.get(Variant.ById(input.variantId));
			if (!variant) {
				return fail("NOT_FOUND", "Variant not found", {
					variantId: input.variantId,
				});
			}
			return { variant };
		},

		write: (ctx, { variant }) => {
			ctx.repos.variant.delete(Variant.ById(variant.id));
			return { success: true };
		},
	});
