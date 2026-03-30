import type { Cursor, Page } from "../../models/common";
import type { Task } from "../../models/task";
import type { DbReadCtx, DbWriteCtx } from "../common";

export interface TaskRepository {
	get(ctx: DbReadCtx, spec: Task.Spec): Promise<Task | null>;
	list(
		ctx: DbReadCtx,
		spec: Task.Spec,
		cursor: Cursor<Task.SortKey>,
	): Promise<Page<Task>>;
	count(ctx: DbReadCtx, spec: Task.Spec): Promise<number>;
	upsert(ctx: DbWriteCtx, task: Task): Promise<void>;
	delete(ctx: DbWriteCtx, spec: Task.Spec): Promise<number>;
}
