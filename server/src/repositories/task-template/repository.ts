import type { Cursor, Page } from "../../models/common";
import type { TaskTemplate } from "../../models/task-template";
import type { DbReadCtx, DbWriteCtx } from "../common";

export interface TaskTemplateRepository {
	get(ctx: DbReadCtx, spec: TaskTemplate.Spec): Promise<TaskTemplate | null>;
	list(
		ctx: DbReadCtx,
		spec: TaskTemplate.Spec,
		cursor: Cursor<TaskTemplate.SortKey>,
	): Promise<Page<TaskTemplate>>;
	listAll(ctx: DbReadCtx): Promise<TaskTemplate[]>;
	upsert(ctx: DbWriteCtx, template: TaskTemplate): Promise<void>;
	delete(ctx: DbWriteCtx, spec: TaskTemplate.Spec): Promise<number>;
}
