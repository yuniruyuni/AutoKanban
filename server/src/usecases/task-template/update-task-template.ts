import { fail } from "../../models/common";
import { TaskTemplate } from "../../models/task-template";
import { usecase } from "../runner";

export interface UpdateTaskTemplateInput {
	id: string;
	title?: string;
	description?: string | null;
	condition?: TaskTemplate.Condition;
	sortOrder?: number;
}

export const updateTaskTemplate = (input: UpdateTaskTemplateInput) =>
	usecase({
		read: (ctx) => {
			const template = ctx.repos.taskTemplate.get(
				TaskTemplate.ById(input.id),
			);
			if (!template) {
				return fail("NOT_FOUND", "Task template not found");
			}
			return { template };
		},

		process: (_ctx, { template }) => {
			const updated: TaskTemplate = {
				...template,
				title: input.title?.trim() ?? template.title,
				description:
					input.description !== undefined
						? (input.description?.trim() || null)
						: template.description,
				condition:
					input.condition !== undefined
						? input.condition
						: template.condition,
				sortOrder: input.sortOrder ?? template.sortOrder,
				updatedAt: new Date(),
			};
			return { template: updated };
		},

		write: (ctx, { template }) => {
			ctx.repos.taskTemplate.upsert(template);
			return template;
		},
	});
