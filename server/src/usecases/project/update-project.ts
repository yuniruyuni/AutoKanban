import { fail } from "../../models/common";
import { Project } from "../../models/project";
import { usecase } from "../runner";

export interface UpdateProjectInput {
	projectId: string;
	name?: string;
	description?: string | null;
}

export const updateProject = (input: UpdateProjectInput) =>
	usecase({
		read: async (ctx) => {
			const project = await ctx.repos.project.get(
				Project.ById(input.projectId),
			);
			if (!project) {
				return fail("NOT_FOUND", "Project not found", {
					projectId: input.projectId,
				});
			}
			return { project };
		},

		process: (_ctx, { project }) => {
			const updated = {
				...project,
				...(input.name !== undefined && { name: input.name }),
				...(input.description !== undefined && {
					description: input.description,
				}),
				updatedAt: new Date(),
			};
			return { project: updated };
		},

		write: async (ctx, { project }) => {
			await ctx.repos.project.upsert(project);
			return project;
		},
	});
