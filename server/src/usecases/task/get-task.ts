// @specre 01KPNSHJW3JZ7Y5SF7TBX5HTYC
import { fail } from "../../models/common";
import { Task } from "../../models/task";
import { usecase } from "../runner";

export interface GetTaskInput {
	taskId: string;
}

export const getTask = (input: GetTaskInput) =>
	usecase({
		read: async (ctx) => {
			const task = await ctx.repos.task.get(Task.ById(input.taskId));
			if (!task) {
				return fail("NOT_FOUND", "Task not found", { taskId: input.taskId });
			}
			return task;
		},
	});
