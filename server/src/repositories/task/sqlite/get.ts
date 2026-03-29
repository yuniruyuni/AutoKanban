import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { Task } from "../../../models/task";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import { type TaskRow, rowToTask, taskSpecToSQL } from "./common";

export function get(db: Database, spec: Task.Spec): Task | null {
	const where = compToSQL(
		spec,
		taskSpecToSQL as (s: unknown) => SQLFragment,
	);
	const row = db
		.query<TaskRow, SQLQueryBindings[]>(
			`SELECT * FROM tasks WHERE ${where.query} LIMIT 1`,
		)
		.get(...(where.params as SQLQueryBindings[]));

	return row ? rowToTask(row) : null;
}
