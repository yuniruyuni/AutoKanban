import { usecase } from "../runner";

export interface ListVariantsInput {
	executor: string;
}

export const listVariants = (input: ListVariantsInput) =>
	usecase({
		read: (ctx) => {
			const items = ctx.repos.variant.listByExecutor(input.executor);
			return { items };
		},
	});
