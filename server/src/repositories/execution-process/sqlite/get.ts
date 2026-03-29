import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { ExecutionProcess } from "../../../models/execution-process";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import {
	type ExecutionProcessRow,
	executionProcessSpecToSQL,
	rowToExecutionProcess,
} from "./common";

export function get(
	db: Database,
	spec: ExecutionProcess.Spec,
): ExecutionProcess | null {
	const where = compToSQL(
		spec,
		executionProcessSpecToSQL as (s: unknown) => SQLFragment,
	);
	const row = db
		.query<ExecutionProcessRow, SQLQueryBindings[]>(
			`SELECT * FROM execution_processes WHERE ${where.query} LIMIT 1`,
		)
		.get(...(where.params as SQLQueryBindings[]));

	return row ? rowToExecutionProcess(row) : null;
}
