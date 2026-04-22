// @specre 01KPNSHJW3JZ7Y5SF7TBX5HTYC
import { fail } from "../../models/common";
import { Task } from "../../models/task";
import { usecase } from "../runner";

export const getTask = (taskId: string) =>
	usecase({
		read: async (ctx) => {
			const task = await ctx.repos.task.get(Task.ById(taskId));
			if (!task) {
				return fail("NOT_FOUND", "Task not found", { taskId });
			}
			return task;
		},
	});
