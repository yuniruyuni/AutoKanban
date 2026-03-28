import { usecase } from "../runner";

export const listTaskTemplates = () =>
	usecase({
		read: (ctx) => {
			return { templates: ctx.repos.taskTemplate.listAll() };
		},
	});
