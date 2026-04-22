// @specre 01KPNSHJVW2C6CC3W5CGH8BT3X
import { fail } from "../../models/common";
import { Project } from "../../models/project";
import { usecase } from "../runner";

export const updateProject = (
	projectId: string,
	fields: Project.UpdateFields,
) =>
	usecase({
		read: async (ctx) => {
			const project = await ctx.repos.project.get(Project.ById(projectId));
			if (!project) {
				return fail("NOT_FOUND", "Project not found", {
					projectId,
				});
			}
			return { project };
		},

		process: (ctx, { project }) => {
			const updated = Project.applyUpdate(project, fields, ctx.now);
			return { project: updated };
		},

		write: async (ctx, { project }) => {
			await ctx.repos.project.upsert(project);
			return project;
		},
	});
