import type { Database } from "bun:sqlite";
import type { Cursor, Page } from "../../../models/common";
import type { Task } from "../../../models/task";
import type { ITaskRepository } from "../repository";
import { count } from "./count";
import { del } from "./delete";
import { get } from "./get";
import { list } from "./list";
import { upsert } from "./upsert";

export class TaskRepository implements ITaskRepository {
	constructor(private db: Database) {}

	get(spec: Task.Spec): Task | null {
		return get(this.db, spec);
	}

	list(spec: Task.Spec, cursor: Cursor<Task.SortKey>): Page<Task> {
		return list(this.db, spec, cursor);
	}

	upsert(task: Task): void {
		upsert(this.db, task);
	}

	delete(spec: Task.Spec): number {
		return del(this.db, spec);
	}

	count(spec: Task.Spec): number {
		return count(this.db, spec);
	}
}
