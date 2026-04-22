import { z } from "zod";
import { Task } from "../../../models/task";
import { createTask } from "../../../usecases/task/create-task";
import { deleteTask } from "../../../usecases/task/delete-task";
import { getTask } from "../../../usecases/task/get-task";
import { listTasks } from "../../../usecases/task/list-tasks";
import { updateTask } from "../../../usecases/task/update-task";
import { handleResult } from "../handle-result";
import { publicProcedure, router } from "../init";

const TaskStatusSchema = z.enum([
	"todo",
	"inprogress",
	"inreview",
	"done",
	"cancelled",
]);

export const taskRouter = router({
	create: publicProcedure
		.input(
			z.object({
				projectId: z.string().uuid(),
				title: z.string().min(1),
				description: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const task = Task.create(input);
			return handleResult(await createTask(task).run(ctx));
		}),

	get: publicProcedure
		.input(z.object({ taskId: z.string().uuid() }))
		.query(async ({ ctx, input }) =>
			handleResult(await getTask(input.taskId).run(ctx)),
		),

	list: publicProcedure
		.input(
			z.object({
				projectId: z.string().uuid(),
				status: TaskStatusSchema.optional(),
				cursor: z.string().optional(),
				limit: z.number().min(1).max(100).default(50),
			}),
		)
		.query(async ({ ctx, input }) => {
			const { projectId, ...rest } = input;
			return handleResult(
				await listTasks(
					projectId,
					rest.status ? { status: rest.status } : undefined,
					rest.limit ? { limit: rest.limit } : undefined,
				).run(ctx),
			);
		}),

	update: publicProcedure
		.input(
			z.object({
				taskId: z.string().uuid(),
				title: z.string().min(1).optional(),
				description: z.string().optional(),
				status: TaskStatusSchema.optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { taskId, ...fields } = input;
			return handleResult(await updateTask(taskId, fields).run(ctx));
		}),

	delete: publicProcedure
		.input(
			z.object({
				taskId: z.string().uuid(),
				deleteWorktrees: z.boolean().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { taskId, ...options } = input;
			return handleResult(await deleteTask(taskId, options).run(ctx));
		}),
});
