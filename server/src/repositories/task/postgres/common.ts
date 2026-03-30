import { type SQLFragment, sql } from "../../../lib/db/sql";
import { dateFromSQL } from "../../../lib/db/sql-helpers";
import type { Task } from "../../../models/task";

export interface TaskRow {
	id: string;
	project_id: string;
	title: string;
	description: string | null;
	status: string;
	created_at: Date;
	updated_at: Date;
}

type TaskSpecData =
	| { type: "ById"; id: string }
	| { type: "ByProject"; projectId: string }
	| { type: "ByStatus"; status: Task.Status }
	| { type: "ByStatuses"; statuses: Task.Status[] };

export function taskSpecToSQL(spec: TaskSpecData): SQLFragment {
	switch (spec.type) {
		case "ById":
			return sql`id = ${spec.id}`;
		case "ByProject":
			return sql`project_id = ${spec.projectId}`;
		case "ByStatus":
			return sql`status = ${spec.status}`;
		case "ByStatuses":
			return sql`status IN (${sql.list(spec.statuses)})`;
	}
}

export function rowToTask(row: TaskRow): Task {
	return {
		id: row.id,
		projectId: row.project_id,
		title: row.title,
		description: row.description,
		status: row.status as Task.Status,
		createdAt: dateFromSQL(row.created_at),
		updatedAt: dateFromSQL(row.updated_at),
	};
}

export function columnName(key: Task.SortKey): string {
	const map: Record<Task.SortKey, string> = {
		createdAt: "created_at",
		updatedAt: "updated_at",
		id: "id",
	};
	return map[key];
}
