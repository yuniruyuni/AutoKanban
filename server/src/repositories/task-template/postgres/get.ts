import type { Database } from "../../common";
import type { TaskTemplate } from "../../../models/task-template";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../common";
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
