import { proxy } from "valtio";

export type TaskStatus =
	| "todo"
	| "inprogress"
	| "inreview"
	| "done"
	| "cancelled";

export interface Task {
	id: string;
	projectId: string;
	title: string;
	description: string | null;
	status: TaskStatus;
	createdAt: string;
	updatedAt: string;
}

interface TaskState {
	tasks: Task[];
	selectedTaskId: string | null;
}

export const taskStore = proxy<TaskState>({
	tasks: [],
	selectedTaskId: null,
});

export const taskActions = {
	setTasks(tasks: Task[]) {
		taskStore.tasks = tasks;
	},

	selectTask(taskId: string | null) {
		taskStore.selectedTaskId = taskId;
	},

	addTask(task: Task) {
		taskStore.tasks.push(task);
	},

	updateTask(taskId: string, updates: Partial<Task>) {
		const index = taskStore.tasks.findIndex((t) => t.id === taskId);
		if (index !== -1) {
			taskStore.tasks[index] = { ...taskStore.tasks[index], ...updates };
		}
	},

	removeTask(taskId: string) {
		const index = taskStore.tasks.findIndex((t) => t.id === taskId);
		if (index !== -1) {
			taskStore.tasks.splice(index, 1);
		}
	},
};
