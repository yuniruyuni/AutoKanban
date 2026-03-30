import type { Database } from "../../common";
import type { Approval } from "../../../models/approval";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../common";
import { approvalSpecToSQL } from "./common";

export async function del(
	db: Database,
	spec: Approval.Spec,
): Promise<number> {
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
