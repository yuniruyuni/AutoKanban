import { fail } from "../../models/common";
import type { TaskTemplate } from "../../models/task-template";
import { usecase } from "../runner";

export const createTaskTemplate = (template: TaskTemplate) =>
	usecase({
		pre: () => {
			if (!template.title?.trim()) {
				return fail("INVALID_INPUT", "Title is required");
			}
			return {};
		},

		write: async (ctx) => {
			await ctx.repos.taskTemplate.upsert(template);
			return template;
		},
	});
