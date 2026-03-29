import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { TaskTemplate } from "../../../models/task-template";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import {
	type TaskTemplateRow,
	rowToTaskTemplate,
	taskTemplateSpecToSQL,
} from "./common";

export function get(
	db: Database,
	spec: TaskTemplate.Spec,
): TaskTemplate | null {
	const where = compToSQL(
		spec,
		taskTemplateSpecToSQL as (s: unknown) => SQLFragment,
	);
	const row = db
		.query<TaskTemplateRow, SQLQueryBindings[]>(
			`SELECT * FROM project_task_templates WHERE ${where.query} LIMIT 1`,
		)
		.get(...(where.params as SQLQueryBindings[]));

	return row ? rowToTaskTemplate(row) : null;
}
