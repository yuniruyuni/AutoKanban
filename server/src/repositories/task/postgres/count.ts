import type { Database } from "../../../lib/db/database";
import type { SQLFragment } from "../../../lib/db/sql";
import { compToSQL } from "../../../lib/db/sql-helpers";
import type { Task } from "../../../models/task";
import { taskSpecToSQL } from "./common";

export async function count(db: Database, spec: Task.Spec): Promise<number> {
	const where = compToSQL(spec, taskSpecToSQL as (s: unknown) => SQLFragment);
	const row = await db.queryGet<{ count: string }>({
		query: `SELECT COUNT(*) as count FROM tasks WHERE ${where.query}`,
		params: where.params,
	});

	return Number(row?.count ?? 0);
}
