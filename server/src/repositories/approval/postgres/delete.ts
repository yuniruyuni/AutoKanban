import type { Database } from "../../../lib/db/database";
import type { SQLFragment } from "../../../lib/db/sql";
import { compToSQL } from "../../../lib/db/sql-helpers";
import type { Approval } from "../../../models/approval";
import { approvalSpecToSQL } from "./common";

export async function del(db: Database, spec: Approval.Spec): Promise<number> {
	const where = compToSQL(
		spec,
		approvalSpecToSQL as (s: unknown) => SQLFragment,
	);
	const result = await db.queryRun({
		query: `DELETE FROM approvals WHERE ${where.query}`,
		params: where.params,
	});

	return result.rowCount;
}
