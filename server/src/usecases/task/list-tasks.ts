// @specre 01KPNSHJW2EPGT866WRE7H4MM4
import { and } from "../../models/common";
import { Task } from "../../models/task";
import { usecase } from "../runner";

export const listTasks = (
	projectId: string,
	filter?: { status?: Task.Status | Task.Status[] },
	pagination?: { limit?: number },
) =>
	usecase({
		read: async (ctx) => {
			const specs: Task.Spec[] = [Task.ByProject(projectId)];

			if (filter?.status) {
				const statuses = Array.isArray(filter.status)
					? filter.status
					: [filter.status];
				specs.push(Task.ByStatuses(...statuses));
			}

			const spec = specs.length === 1 ? specs[0] : (and(...specs) as Task.Spec);

			const cursor = {
				limit: pagination?.limit ?? 50,
				sort: Task.defaultSort,
			};

			const page = await ctx.repos.task.list(spec, cursor);
			return page;
		},
	});
