import { usecase } from "../runner";

export const listVariants = (executor: string) =>
	usecase({
		read: async (ctx) => {
			const items = await ctx.repos.variant.listByExecutor(executor);
			return { items };
		},
	});
