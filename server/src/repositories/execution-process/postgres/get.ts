import type { Database } from "../../../lib/db/database";
import type { SQLFragment } from "../../../lib/db/sql";
import { compToSQL } from "../../../lib/db/sql-helpers";
import type { ExecutionProcess } from "../../../models/execution-process";
import {
	type ExecutionProcessRow,
	executionProcessSpecToSQL,
	rowToExecutionProcess,
} from "./common";

export async function get(
	db: Database,
	spec: ExecutionProcess.Spec,
): Promise<ExecutionProcess | null> {
	const where = compToSQL(
		spec,
		executionProcessSpecToSQL as (s: unknown) => SQLFragment,
	);
	const row = await db.queryGet<ExecutionProcessRow>({
		query: `SELECT * FROM execution_processes WHERE ${where.query} LIMIT 1`,
		params: where.params,
	});

	return row ? rowToExecutionProcess(row) : null;
}
