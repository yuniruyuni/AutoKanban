import type { Database } from "../../../lib/db/database";
import type { SQLFragment } from "../../../lib/db/sql";
import { compToSQL } from "../../../lib/db/sql-helpers";
import type { ExecutionProcess } from "../../../models/execution-process";
import { executionProcessSpecToSQL } from "./common";

export async function del(
	db: Database,
	spec: ExecutionProcess.Spec,
): Promise<number> {
	const where = compToSQL(
		spec,
		executionProcessSpecToSQL as (s: unknown) => SQLFragment,
	);
	const result = await db.queryRun({
		query: `DELETE FROM execution_processes WHERE ${where.query}`,
		params: where.params,
	});

	return result.rowCount;
}
