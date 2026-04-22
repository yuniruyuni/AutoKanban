import { fail } from "../../models/common";
import { TaskTemplate } from "../../models/task-template";
import { usecase } from "../runner";

export const deleteTaskTemplate = (id: string) =>
	usecase({
		read: async (ctx) => {
			const template = await ctx.repos.taskTemplate.get(TaskTemplate.ById(id));
			if (!template) {
				return fail("NOT_FOUND", "Task template not found");
			}
			return { template };
		},

		write: async (ctx, { template }) => {
			await ctx.repos.taskTemplate.delete(TaskTemplate.ById(template.id));
			return { deleted: true };
		},
	});
