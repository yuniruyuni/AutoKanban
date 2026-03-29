import type { PgDatabase } from "../../../db/pg-client";
import type { Cursor, Page } from "../../../models/common";
import type { TaskTemplate } from "../../../models/task-template";
import type { ITaskTemplateRepository } from "../repository";
import { del } from "./delete";
import { get } from "./get";
import { list } from "./list";
import { listAll } from "./list-all";
import { upsert } from "./upsert";

export class PgTaskTemplateRepository implements ITaskTemplateRepository {
	constructor(private db: PgDatabase) {}

	async get(spec: TaskTemplate.Spec): Promise<TaskTemplate | null> {
		return get(this.db, spec);
	}

	async list(
		spec: TaskTemplate.Spec,
		cursor: Cursor<TaskTemplate.SortKey>,
	): Promise<Page<TaskTemplate>> {
		return list(this.db, spec, cursor);
	}

	async listAll(): Promise<TaskTemplate[]> {
		return listAll(this.db);
	}

	async upsert(template: TaskTemplate): Promise<void> {
		await upsert(this.db, template);
	}

	async delete(spec: TaskTemplate.Spec): Promise<number> {
		return del(this.db, spec);
	}
}
