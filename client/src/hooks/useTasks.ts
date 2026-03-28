import { useEffect } from "react";
import { type Task, type TaskStatus, taskActions } from "@/store";
import { trpc } from "@/trpc";

interface UseTasksOptions {
	projectId: string;
	status?: TaskStatus;
	limit?: number;
}

export function useTasks({ projectId, status, limit = 100 }: UseTasksOptions) {
	const query = trpc.task.list.useQuery(
		{ projectId, status, limit },
		{ enabled: !!projectId, refetchInterval: 10000 },
	);

	useEffect(() => {
		if (query.data) {
			const tasks = query.data.items.map(mapTask);
			taskActions.setTasks(tasks);
		}
	}, [query.data]);

	return {
		tasks: query.data?.items.map(mapTask) ?? [],
		hasMore: query.data?.hasMore ?? false,
		isLoading: query.isLoading,
		error: query.error ?? null,
		refetch: query.refetch,
	};
}

export function useTask(taskId: string | null) {
	const query = trpc.task.get.useQuery(
		{ taskId: taskId ?? "" },
		{ enabled: !!taskId },
	);

	return {
		task: query.data ? mapTask(query.data) : null,
		isLoading: query.isLoading,
		error: query.error ?? null,
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
		status: data.status as TaskStatus,
		createdAt: data.createdAt,
		updatedAt: data.updatedAt,
	};
}
