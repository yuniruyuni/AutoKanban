import { fail } from "../../models/common";
import { TaskTemplate } from "../../models/task-template";
import { usecase } from "../runner";

export const updateTaskTemplate = (
	id: string,
	fields: TaskTemplate.UpdateFields,
) =>
	usecase({
		read: async (ctx) => {
			const template = await ctx.repos.taskTemplate.get(TaskTemplate.ById(id));
			if (!template) {
				return fail("NOT_FOUND", "Task template not found");
			}
			return { template };
		},

		process: (ctx, { template }) => {
			const updated = TaskTemplate.applyUpdate(template, fields, ctx.now);
			return { template: updated };
		},

		write: async (ctx, { template }) => {
			await ctx.repos.taskTemplate.upsert(template);
			return template;
		},
	});
