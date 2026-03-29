import { usecase } from "../runner";

export const listTaskTemplates = () =>
	usecase({
		read: async (ctx) => {
			return { templates: await ctx.repos.taskTemplate.listAll() };
		},
	});
