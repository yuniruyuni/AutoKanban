import { fail } from "../../models/common";
import { Variant } from "../../models/variant";
import { usecase } from "../runner";

export interface UpdateVariantInput {
	variantId: string;
	name?: string;
	permissionMode?: string;
	model?: string | null;
	appendPrompt?: string | null;
}

export const updateVariant = (input: UpdateVariantInput) =>
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

		process: (ctx, { variant }) => {
			const updatedVariant: Variant = {
				...variant,
				name: input.name ?? variant.name,
				permissionMode: input.permissionMode ?? variant.permissionMode,
				model: input.model !== undefined ? input.model : variant.model,
				appendPrompt:
					input.appendPrompt !== undefined
						? input.appendPrompt
						: variant.appendPrompt,
				updatedAt: ctx.now,
			};
			return { variant: updatedVariant };
		},

		write: (ctx, { variant }) => {
			ctx.repos.variant.upsert(variant);
			return variant;
		},
	});
