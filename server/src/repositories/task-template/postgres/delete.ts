import type { Database } from "../../../infra/db/database";
import type { SQLFragment } from "../../../infra/db/sql";
import { compToSQL } from "../../../infra/db/sql-helpers";
import type { TaskTemplate } from "../../../models/task-template";
import { taskTemplateSpecToSQL } from "./common";

export async function del(
	db: Database,
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
