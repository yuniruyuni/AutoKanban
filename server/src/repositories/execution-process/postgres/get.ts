import type { PgDatabase } from "../../../db/pg-client";
import type { ExecutionProcess } from "../../../models/execution-process";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import {
	type ExecutionProcessRow,
	executionProcessSpecToSQL,
	rowToExecutionProcess,
} from "./common";

export async function get(
	db: PgDatabase,
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
