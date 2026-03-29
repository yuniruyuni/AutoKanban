import { fail } from "../../models/common";
import { Project } from "../../models/project";
import { Task } from "../../models/task";
import { usecase } from "../runner";

export interface CreateTaskInput {
	projectId: string;
	title: string;
	description?: string | null;
}

export const createTask = (input: CreateTaskInput) =>
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

		process: (_, { project }) => {
			const task = Task.create({
				projectId: project.id,
				title: input.title,
				description: input.description,
			});
			return { task };
		},

		write: async (ctx, { task }) => {
			await ctx.repos.task.upsert(task);
			return task;
		},
	});
