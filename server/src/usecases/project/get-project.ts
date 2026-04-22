// @specre 01KPNSHJVSHA5H1SKKQ154SW5Z
import { type Fail, fail } from "../../models/common";
import type { ProjectWithStats } from "../../models/project";
import { usecase } from "../runner";

export const getProject = (projectId: string) =>
	usecase({
		read: async (ctx): Promise<ProjectWithStats | Fail> => {
			const project = await ctx.repos.project.getWithStats(projectId);
			if (!project) {
				return fail("NOT_FOUND", "Project not found", {
					projectId,
				});
			}
			return project;
		},
	});
