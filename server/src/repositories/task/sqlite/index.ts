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

	async get(spec: Task.Spec): Promise<Task | null> {
		return get(this.db, spec);
	}

	async list(
		spec: Task.Spec,
		cursor: Cursor<Task.SortKey>,
	): Promise<Page<Task>> {
		return list(this.db, spec, cursor);
	}

	async upsert(task: Task): Promise<void> {
		upsert(this.db, task);
	}

	async delete(spec: Task.Spec): Promise<number> {
		return del(this.db, spec);
	}

	async count(spec: Task.Spec): Promise<number> {
		return count(this.db, spec);
	}
}
