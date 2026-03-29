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

	get(spec: TaskTemplate.Spec): TaskTemplate | null {
		return get(this.db, spec);
	}

	list(
		spec: TaskTemplate.Spec,
		cursor: Cursor<TaskTemplate.SortKey>,
	): Page<TaskTemplate> {
		return list(this.db, spec, cursor);
	}

	listAll(): TaskTemplate[] {
		return listAll(this.db);
	}

	upsert(template: TaskTemplate): void {
		upsert(this.db, template);
	}

	delete(spec: TaskTemplate.Spec): number {
		return del(this.db, spec);
	}
}
