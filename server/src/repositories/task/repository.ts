import type { Cursor, Page } from "../../models/common";
import type { Task } from "../../models/task";

export interface ITaskRepository {
	get(spec: Task.Spec): Task | null;
	list(spec: Task.Spec, cursor: Cursor<Task.SortKey>): Page<Task>;
	upsert(task: Task): void;
	delete(spec: Task.Spec): number;
	count(spec: Task.Spec): number;
}
