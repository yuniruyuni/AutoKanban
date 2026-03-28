import { usecase } from "../runner";

export const listTools = () =>
	usecase({
		read: (ctx) => {
			const tools = ctx.repos.tool.listAll();
			return { items: tools };
		},
	});
