import { type SQLFragment, sql } from "../../../lib/db/sql";
import { dateFromSQL } from "../../../lib/db/sql-helpers";
import type { TaskTemplate } from "../../../models/task-template";

export interface TaskTemplateRow {
	id: string;
	title: string;
	description: string | null;
	condition: string | null;
	sort_order: number;
	created_at: Date;
	updated_at: Date;
}

type TaskTemplateSpecData = { type: "ById"; id: string } | { type: "All" };

export function taskTemplateSpecToSQL(spec: TaskTemplateSpecData): SQLFragment {
	switch (spec.type) {
		case "ById":
			return sql`id = ${spec.id}`;
		case "All":
			return sql`1 = 1`;
	}
}

export function rowToTaskTemplate(row: TaskTemplateRow): TaskTemplate {
	return {
		id: row.id,
		title: row.title,
		description: row.description,
		condition: row.condition as TaskTemplate.Condition,
		sortOrder: row.sort_order,
		createdAt: dateFromSQL(row.created_at),
		updatedAt: dateFromSQL(row.updated_at),
	};
}

export function columnName(key: TaskTemplate.SortKey): string {
	const map: Record<TaskTemplate.SortKey, string> = {
		sortOrder: "sort_order",
		createdAt: "created_at",
		id: "id",
	};
	return map[key];
}
