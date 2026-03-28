import { and } from "../../models/common";
import { Task } from "../../models/task";
import { usecase } from "../runner";

export interface ListTasksInput {
	projectId: string;
	status?: Task.Status | Task.Status[];
	limit?: number;
}

export const listTasks = (input: ListTasksInput) =>
	usecase({
		read: (ctx) => {
			const specs: Task.Spec[] = [Task.ByProject(input.projectId)];

			if (input.status) {
				const statuses = Array.isArray(input.status)
					? input.status
					: [input.status];
				specs.push(Task.ByStatuses(...statuses));
			}

			const spec = specs.length === 1 ? specs[0] : (and(...specs) as Task.Spec);

			const cursor = {
				limit: input.limit ?? 50,
				sort: Task.defaultSort,
			};

			const page = ctx.repos.task.list(spec, cursor);
			return page;
		},
	});
