import type { Database } from "../../../infra/db/database";
import type { SQLFragment } from "../../../infra/db/sql";
import { compToSQL } from "../../../infra/db/sql-helpers";
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
