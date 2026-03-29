import type { PgDatabase } from "../../../db/pg-client";
import type { Task } from "../../../models/task";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import { taskSpecToSQL } from "./common";

export async function del(db: PgDatabase, spec: Task.Spec): Promise<number> {
	const where = compToSQL(spec, taskSpecToSQL as (s: unknown) => SQLFragment);
	const result = await db.queryRun({
		query: `DELETE FROM tasks WHERE ${where.query}`,
		params: where.params,
	});

	return result.rowCount;
}
