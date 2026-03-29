import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { ExecutionProcess } from "../../../models/execution-process";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import { executionProcessSpecToSQL } from "./common";

export function del(db: Database, spec: ExecutionProcess.Spec): number {
	const where = compToSQL(
		spec,
		executionProcessSpecToSQL as (s: unknown) => SQLFragment,
	);
	const result = db
		.query<{ changes: number }, SQLQueryBindings[]>(
			`DELETE FROM execution_processes WHERE ${where.query}`,
		)
		.run(...(where.params as SQLQueryBindings[]));

	return result.changes;
}
