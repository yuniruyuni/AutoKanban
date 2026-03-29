import { usecase } from "../runner";

export interface ListVariantsInput {
	executor: string;
}

export const listVariants = (input: ListVariantsInput) =>
	usecase({
		read: async (ctx) => {
			const items = await ctx.repos.variant.listByExecutor(input.executor);
			return { items };
		},
	});
