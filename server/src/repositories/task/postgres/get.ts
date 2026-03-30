import type { PgDatabase } from "../../../db/pg-client";
import type { Task } from "../../../models/task";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../common";
import { rowToTask, type TaskRow, taskSpecToSQL } from "./common";

export async function get(
	db: PgDatabase,
	spec: Task.Spec,
): Promise<Task | null> {
	const where = compToSQL(spec, taskSpecToSQL as (s: unknown) => SQLFragment);
	const row = await db.queryGet<TaskRow>({
		query: `SELECT * FROM tasks WHERE ${where.query} LIMIT 1`,
		params: where.params,
	});

	return row ? rowToTask(row) : null;
}
