import type { Database } from "../../common";
import type { Task } from "../../../models/task";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../common";
import { taskSpecToSQL } from "./common";

export async function del(db: Database, spec: Task.Spec): Promise<number> {
	const where = compToSQL(spec, taskSpecToSQL as (s: unknown) => SQLFragment);
	const result = await db.queryRun({
		query: `DELETE FROM tasks WHERE ${where.query}`,
		params: where.params,
	});

	return result.rowCount;
}
