import { usecase } from "../runner";

export const listTools = () =>
	usecase({
		read: async (ctx) => {
			const tools = await ctx.repos.tool.listAll();
			return { items: tools };
		},
	});
