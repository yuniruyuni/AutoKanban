import type { Cursor, Page } from "../../../models/common";
import type { TaskTemplate } from "../../../models/task-template";
import type { DbReadCtx, DbWriteCtx } from "../../common";
import type { TaskTemplateRepository as ITaskTemplateRepository } from "../repository";
import { del } from "./delete";
import { get } from "./get";
import { list } from "./list";
import { listAll } from "./list-all";
import { upsert } from "./upsert";

export class TaskTemplateRepository implements ITaskTemplateRepository {
	async get(
		ctx: DbReadCtx,
		spec: TaskTemplate.Spec,
	): Promise<TaskTemplate | null> {
		return get(ctx.db, spec);
	}

	async list(
		ctx: DbReadCtx,
		spec: TaskTemplate.Spec,
		cursor: Cursor<TaskTemplate.SortKey>,
	): Promise<Page<TaskTemplate>> {
		return list(ctx.db, spec, cursor);
	}

	async listAll(ctx: DbReadCtx): Promise<TaskTemplate[]> {
		return listAll(ctx.db);
	}

	async upsert(ctx: DbWriteCtx, template: TaskTemplate): Promise<void> {
		await upsert(ctx.db, template);
	}

	async delete(ctx: DbWriteCtx, spec: TaskTemplate.Spec): Promise<number> {
		return del(ctx.db, spec);
	}
}
