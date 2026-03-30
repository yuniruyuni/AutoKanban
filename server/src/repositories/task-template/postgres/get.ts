import type { Database } from "../../../lib/db/database";
import type { SQLFragment } from "../../../lib/db/sql";
import { compToSQL } from "../../../lib/db/sql-helpers";
import type { TaskTemplate } from "../../../models/task-template";
import {
	rowToTaskTemplate,
	type TaskTemplateRow,
	taskTemplateSpecToSQL,
} from "./common";

export async function get(
	db: Database,
	spec: TaskTemplate.Spec,
): Promise<TaskTemplate | null> {
	const where = compToSQL(
		spec,
		taskTemplateSpecToSQL as (s: unknown) => SQLFragment,
	);
	const row = await db.queryGet<TaskTemplateRow>({
		query: `SELECT * FROM project_task_templates WHERE ${where.query} LIMIT 1`,
		params: where.params,
	});

	return row ? rowToTaskTemplate(row) : null;
}
