import type { Cursor, Page } from "../../../models/common";
import type { Task } from "../../../models/task";
import type { DbReadCtx, DbWriteCtx } from "../../common";
import type { TaskRepository as ITaskRepository } from "../repository";
import { count } from "./count";
import { del } from "./delete";
import { get } from "./get";
import { list } from "./list";
import { upsert } from "./upsert";

export class TaskRepository implements ITaskRepository {
	async get(ctx: DbReadCtx, spec: Task.Spec): Promise<Task | null> {
		return get(ctx.db, spec);
	}

	async list(
		ctx: DbReadCtx,
		spec: Task.Spec,
		cursor: Cursor<Task.SortKey>,
	): Promise<Page<Task>> {
		return list(ctx.db, spec, cursor);
	}

	async upsert(ctx: DbWriteCtx, task: Task): Promise<void> {
		return upsert(ctx.db, task);
	}

	async delete(ctx: DbWriteCtx, spec: Task.Spec): Promise<number> {
		return del(ctx.db, spec);
	}

	async count(ctx: DbReadCtx, spec: Task.Spec): Promise<number> {
		return count(ctx.db, spec);
	}
}
