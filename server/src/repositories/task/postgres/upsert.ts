import type { Database } from "../../../infra/db/database";
import { dateToSQL } from "../../../infra/db/sql-helpers";
import type { Task } from "../../../models/task";

export async function upsert(db: Database, task: Task): Promise<void> {
	await db.queryRun({
		query: `INSERT INTO tasks (id, project_id, title, description, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       description = excluded.description,
       status = excluded.status,
       updated_at = excluded.updated_at`,
		params: [
			task.id,
			task.projectId,
			task.title,
			task.description,
			task.status,
			dateToSQL(task.createdAt),
			dateToSQL(task.updatedAt),
		],
	});
}
