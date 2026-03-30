import type { PgDatabase } from "../../common";
import type { TaskTemplate } from "../../../models/task-template";
import { rowToTaskTemplate, type TaskTemplateRow } from "./common";

export async function listAll(db: PgDatabase): Promise<TaskTemplate[]> {
	const rows = await db.queryAll<TaskTemplateRow>({
		query:
			"SELECT * FROM project_task_templates ORDER BY sort_order ASC, id ASC",
		params: [],
	});
	return rows.map(rowToTaskTemplate);
}
