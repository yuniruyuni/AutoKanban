import type { PgDatabase } from "../../../db/pg-client";
import type { Task } from "../../../models/task";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../common";
import { taskSpecToSQL } from "./common";

export async function count(db: PgDatabase, spec: Task.Spec): Promise<number> {
	const where = compToSQL(spec, taskSpecToSQL as (s: unknown) => SQLFragment);
	const row = await db.queryGet<{ count: string }>({
		query: `SELECT COUNT(*) as count FROM tasks WHERE ${where.query}`,
		params: where.params,
	});

	return Number(row?.count ?? 0);
}
