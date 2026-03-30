import type { Database } from "../../../lib/db/database";
import type { TaskTemplate } from "../../../models/task-template";
import { rowToTaskTemplate, type TaskTemplateRow } from "./common";

export async function listAll(db: Database): Promise<TaskTemplate[]> {
	const rows = await db.queryAll<TaskTemplateRow>({
		query:
			"SELECT * FROM project_task_templates ORDER BY sort_order ASC, id ASC",
		params: [],
	});
	return rows.map(rowToTaskTemplate);
}
