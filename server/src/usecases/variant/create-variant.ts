import { Variant } from "../../models/variant";
import { usecase } from "../runner";

export interface CreateVariantInput {
	executor: string;
	name: string;
	permissionMode?: string;
	model?: string | null;
	appendPrompt?: string | null;
}

export const createVariant = (input: CreateVariantInput) =>
	usecase({
		process: () => {
			const variant = Variant.create({
				executor: input.executor,
				name: input.name,
				permissionMode: input.permissionMode,
				model: input.model,
				appendPrompt: input.appendPrompt,
			});
			return { variant };
		},

		write: (ctx, { variant }) => {
			ctx.repos.variant.upsert(variant);
			return variant;
		},
	});
