import type { Task, TaskStatus } from "@/store";
import { trpc } from "@/trpc";

interface CreateTaskInput {
	projectId: string;
	title: string;
	description?: string;
}

interface UpdateTaskInput {
	taskId: string;
	title?: string;
	description?: string;
	status?: TaskStatus;
}

export function useTaskMutations() {
	const utils = trpc.useUtils();

	const createTask = trpc.task.create.useMutation({
		onSuccess: () => {
			utils.task.list.invalidate();
		},
	});

	const updateTask = trpc.task.update.useMutation({
		onSuccess: () => {
			utils.task.list.invalidate();
			utils.task.get.invalidate();
		},
	});

	const deleteTask = trpc.task.delete.useMutation({
		onSuccess: () => {
			utils.task.list.invalidate();
		},
	});

	return {
		createTask: async (input: CreateTaskInput): Promise<Task> => {
			const result = await createTask.mutateAsync(input);
			return mapTask(result);
		},

		updateTask: async (input: UpdateTaskInput): Promise<Task> => {
			const result = await updateTask.mutateAsync(input);
			return mapTask(result);
		},

		deleteTask: async (taskId: string): Promise<void> => {
			await deleteTask.mutateAsync({ taskId });
		},

		isCreating: createTask.isPending,
		isUpdating: updateTask.isPending,
		isDeleting: deleteTask.isPending,
	};
}

// Map server response to client Task type
function mapTask(data: {
	id: string;
	projectId: string;
	title: string;
	description: string | null;
	status: string;
	createdAt: string;
	updatedAt: string;
}): Task {
	return {
		id: data.id,
		projectId: data.projectId,
		title: data.title,
		description: data.description,
		status: data.status as Task["status"],
		createdAt: data.createdAt,
		updatedAt: data.updatedAt,
	};
}
