// @specre 01KPNSHJVSHA5H1SKKQ154SW5Z
import { type Fail, fail } from "../../models/common";
import type { ProjectWithStats } from "../../models/project";
import { usecase } from "../runner";

export interface GetProjectInput {
	projectId: string;
}

export const getProject = (input: GetProjectInput) =>
	usecase({
		read: async (ctx): Promise<ProjectWithStats | Fail> => {
			const project = await ctx.repos.project.getWithStats(input.projectId);
			if (!project) {
				return fail("NOT_FOUND", "Project not found", {
					projectId: input.projectId,
				});
			}
			return project;
		},
	});
