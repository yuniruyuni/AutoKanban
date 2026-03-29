import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { Task } from "../../../models/task";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import { taskSpecToSQL } from "./common";

export function del(db: Database, spec: Task.Spec): number {
	const where = compToSQL(spec, taskSpecToSQL as (s: unknown) => SQLFragment);
	const result = db
		.query<{ changes: number }, SQLQueryBindings[]>(
			`DELETE FROM tasks WHERE ${where.query}`,
		)
		.run(...(where.params as SQLQueryBindings[]));

	return result.changes;
}
