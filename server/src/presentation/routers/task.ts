import { z } from "zod";
import { createTask } from "../../usecases/task/create-task";
import { deleteTask } from "../../usecases/task/delete-task";
import { getTask } from "../../usecases/task/get-task";
import { listTasks } from "../../usecases/task/list-tasks";
import { updateTask } from "../../usecases/task/update-task";
import { handleResult } from "../handle-result";
import { publicProcedure, router } from "../trpc";

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
		.mutation(async ({ ctx, input }) =>
			handleResult(await createTask(input).run(ctx)),
		),

	get: publicProcedure
		.input(z.object({ taskId: z.string().uuid() }))
		.query(async ({ ctx, input }) =>
			handleResult(await getTask(input).run(ctx)),
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
		.query(async ({ ctx, input }) =>
			handleResult(await listTasks(input).run(ctx)),
		),

	update: publicProcedure
		.input(
			z.object({
				taskId: z.string().uuid(),
				title: z.string().min(1).optional(),
				description: z.string().optional(),
				status: TaskStatusSchema.optional(),
			}),
		)
		.mutation(async ({ ctx, input }) =>
			handleResult(await updateTask(input).run(ctx)),
		),

	delete: publicProcedure
		.input(z.object({ taskId: z.string().uuid() }))
		.mutation(async ({ ctx, input }) =>
			handleResult(await deleteTask(input).run(ctx)),
		),
});
