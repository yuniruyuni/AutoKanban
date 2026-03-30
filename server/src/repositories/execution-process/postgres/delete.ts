import type { Database } from "../../common";
import type { ExecutionProcess } from "../../../models/execution-process";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../common";
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
