import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { Task } from "../../../models/task";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import { taskSpecToSQL } from "./common";

export function count(db: Database, spec: Task.Spec): number {
	const where = compToSQL(spec, taskSpecToSQL as (s: unknown) => SQLFragment);
	const row = db
		.query<{ count: number }, SQLQueryBindings[]>(
			`SELECT COUNT(*) as count FROM tasks WHERE ${where.query}`,
		)
		.get(...(where.params as SQLQueryBindings[]));

	return row?.count ?? 0;
}
