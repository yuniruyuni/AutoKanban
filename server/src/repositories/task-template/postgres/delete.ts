import type { PgDatabase } from "../../common";
import type { TaskTemplate } from "../../../models/task-template";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../common";
import { taskTemplateSpecToSQL } from "./common";

export async function del(
	db: PgDatabase,
	spec: TaskTemplate.Spec,
): Promise<number> {
	const where = compToSQL(
		spec,
		taskTemplateSpecToSQL as (s: unknown) => SQLFragment,
	);
	const result = await db.queryRun({
		query: `DELETE FROM project_task_templates WHERE ${where.query}`,
		params: where.params,
	});

	return result.rowCount;
}
