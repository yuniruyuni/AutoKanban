import type { Variant } from "../../models/variant";
import { usecase } from "../runner";

export const createVariant = (variant: Variant) =>
	usecase({
		write: async (ctx) => {
			await ctx.repos.variant.upsert(variant);
			return variant;
		},
	});
