import type { ProjectWithStats } from "../../models/project";
import { usecase } from "../runner";

export interface ListProjectsOutput {
	projects: ProjectWithStats[];
}

export const listProjects = () =>
	usecase({
		read: (ctx) => {
			const projects = ctx.repos.project.listAllWithStats();
			return { projects };
		},

		result: (state): ListProjectsOutput => state,
	});
