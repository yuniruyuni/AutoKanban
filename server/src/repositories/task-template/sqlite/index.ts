import type { Database } from "bun:sqlite";
import type { Cursor, Page } from "../../../models/common";
import type { TaskTemplate } from "../../../models/task-template";
import type { ITaskTemplateRepository } from "../repository";
import { del } from "./delete";
import { get } from "./get";
import { list } from "./list";
import { listAll } from "./list-all";
import { upsert } from "./upsert";

export class TaskTemplateRepository implements ITaskTemplateRepository {
	constructor(private db: Database) {}

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
		upsert(this.db, template);
	}

	async delete(spec: TaskTemplate.Spec): Promise<number> {
		return del(this.db, spec);
	}
}
