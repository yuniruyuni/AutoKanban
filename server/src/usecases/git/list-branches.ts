import { fail } from "../../models/common";
import { Project } from "../../models/project";
import { usecase } from "../runner";

export interface ListBranchesInput {
	projectId: string;
}

export interface Branch {
	name: string;
	isCurrent: boolean;
}

export const listBranches = (input: ListBranchesInput) =>
	usecase({
		read: async (ctx) => {
			const project = await ctx.repos.project.get(
				Project.ById(input.projectId),
			);
			if (!project) {
				return fail("NOT_FOUND", "Project not found");
			}

			const branches = await ctx.repos.git.listBranches(project.repoPath);
			return { branches };
		},

		result: (state) => state as { branches: Branch[] },
	});
