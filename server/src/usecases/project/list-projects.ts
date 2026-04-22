// @specre 01KPNSHJVQX8V0AQX7PYA0HPWG
import { usecase } from "../runner";

export const listProjects = () =>
	usecase({
		read: async (ctx) => {
			const projects = await ctx.repos.project.listAllWithStats();
			return { projects };
		},
	});
