import type { Database } from "../../../lib/db/database";
import type { SQLFragment } from "../../../lib/db/sql";
import { compToSQL } from "../../../lib/db/sql-helpers";
import type { Task } from "../../../models/task";
import { rowToTask, type TaskRow, taskSpecToSQL } from "./common";

export async function get(db: Database, spec: Task.Spec): Promise<Task | null> {
	const where = compToSQL(spec, taskSpecToSQL as (s: unknown) => SQLFragment);
	const row = await db.queryGet<TaskRow>({
		query: `SELECT * FROM tasks WHERE ${where.query} LIMIT 1`,
		params: where.params,
	});

	return row ? rowToTask(row) : null;
}
