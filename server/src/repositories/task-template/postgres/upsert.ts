import type { Database } from "../../../lib/db/database";
import { dateToSQL } from "../../../lib/db/sql-helpers";
import type { TaskTemplate } from "../../../models/task-template";

export async function upsert(
	db: Database,
	template: TaskTemplate,
): Promise<void> {
	await db.queryRun({
		query: `INSERT INTO project_task_templates (id, title, description, condition, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         description = excluded.description,
         condition = excluded.condition,
         sort_order = excluded.sort_order,
         updated_at = excluded.updated_at`,
		params: [
			template.id,
			template.title,
			template.description,
			template.condition,
			template.sortOrder,
			dateToSQL(template.createdAt),
			dateToSQL(template.updatedAt),
		],
	});
}
