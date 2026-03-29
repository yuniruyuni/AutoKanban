import type { Cursor, Page } from "../../models/common";
import type { Task } from "../../models/task";

export interface ITaskRepository {
	get(spec: Task.Spec): Promise<Task | null>;
	list(spec: Task.Spec, cursor: Cursor<Task.SortKey>): Promise<Page<Task>>;
	upsert(task: Task): Promise<void>;
	delete(spec: Task.Spec): Promise<number>;
	count(spec: Task.Spec): Promise<number>;
}
