import type { Database } from "../../../lib/db/database";
import type { SQLFragment } from "../../../lib/db/sql";
import { compToSQL } from "../../../lib/db/sql-helpers";
import type { Task } from "../../../models/task";
import { taskSpecToSQL } from "./common";

export async function del(db: Database, spec: Task.Spec): Promise<number> {
	const where = compToSQL(spec, taskSpecToSQL as (s: unknown) => SQLFragment);
	const result = await db.queryRun({
		query: `DELETE FROM tasks WHERE ${where.query}`,
		params: where.params,
	});

	return result.rowCount;
}
