import { fail } from "../../models/common";
import { TaskTemplate } from "../../models/task-template";
import { usecase } from "../runner";

export interface CreateTaskTemplateInput {
	title: string;
	description?: string | null;
	condition?: TaskTemplate.Condition;
	sortOrder?: number;
}

export const createTaskTemplate = (input: CreateTaskTemplateInput) =>
	usecase({
		pre: () => {
			if (!input.title?.trim()) {
				return fail("INVALID_INPUT", "Title is required");
			}
			return {};
		},

		process: () => {
			const template = TaskTemplate.create({
				title: input.title.trim(),
				description: input.description?.trim() || null,
				condition: input.condition,
				sortOrder: input.sortOrder,
			});
			return { template };
		},

		write: (ctx, { template }) => {
			ctx.repos.taskTemplate.upsert(template);
			return template;
		},
	});
