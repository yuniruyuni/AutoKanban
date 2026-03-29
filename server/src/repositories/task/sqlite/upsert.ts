import type { Database } from "bun:sqlite";
import type { Task } from "../../../models/task";
import { dateToSQL } from "../../common";

export function upsert(db: Database, task: Task): void {
	db.query(
		`INSERT INTO tasks (id, project_id, title, description, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       description = excluded.description,
       status = excluded.status,
       updated_at = excluded.updated_at`,
	).run(
		task.id,
		task.projectId,
		task.title,
		task.description,
		task.status,
		dateToSQL(task.createdAt),
		dateToSQL(task.updatedAt),
	);
}
