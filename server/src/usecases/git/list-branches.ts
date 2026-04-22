// @specre 01KPNSJ3RR53PPC1KAWR4HB2PP
import { fail } from "../../models/common";
import { Project } from "../../models/project";
import { usecase } from "../runner";

export interface Branch {
	name: string;
	isCurrent: boolean;
}

export const listBranches = (projectId: string) =>
	usecase({
		read: async (ctx) => {
			const project = await ctx.repos.project.get(Project.ById(projectId));
			if (!project) {
				return fail("NOT_FOUND", "Project not found");
			}

			return { project };
		},

		post: async (ctx, { project }) => {
			const branches = await ctx.repos.git.listBranches(project.repoPath);
			return { branches };
		},

		result: (state) => state as { branches: Branch[] },
	});
