import type { Database } from "bun:sqlite";
import type { TaskTemplate } from "../../../models/task-template";
import { type TaskTemplateRow, rowToTaskTemplate } from "./common";

export function listAll(db: Database): TaskTemplate[] {
	const rows = db
		.query<TaskTemplateRow, []>(
			"SELECT * FROM project_task_templates ORDER BY sort_order ASC, id ASC",
		)
		.all();
	return rows.map(rowToTaskTemplate);
}
