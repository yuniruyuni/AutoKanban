import { fail } from "../../models/common";
import { TaskTemplate } from "../../models/task-template";
import { usecase } from "../runner";

export interface DeleteTaskTemplateInput {
	id: string;
}

export const deleteTaskTemplate = (input: DeleteTaskTemplateInput) =>
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

		write: (ctx, { template }) => {
			ctx.repos.taskTemplate.delete(TaskTemplate.ById(template.id));
			return { deleted: true };
		},
	});
