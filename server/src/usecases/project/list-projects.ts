// @specre 01KPNSHJVQX8V0AQX7PYA0HPWG
import type { ProjectWithStats } from "../../models/project";
import { usecase } from "../runner";

export interface ListProjectsOutput {
	projects: ProjectWithStats[];
}

export const listProjects = () =>
	usecase({
		read: async (ctx) => {
			const projects = await ctx.repos.project.listAllWithStats();
			return { projects };
		},

		result: (state): ListProjectsOutput => state,
	});
