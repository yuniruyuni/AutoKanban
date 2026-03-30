import type { Database } from "../../../infra/db/database";
import type { SQLFragment } from "../../../infra/db/sql";
import { compToSQL } from "../../../infra/db/sql-helpers";
import type { Approval } from "../../../models/approval";
import { type ApprovalRow, approvalSpecToSQL, rowToApproval } from "./common";

export async function get(
	db: Database,
	spec: Approval.Spec,
): Promise<Approval | null> {
	const where = compToSQL(
		spec,
		approvalSpecToSQL as (s: unknown) => SQLFragment,
	);
	const row = await db.queryGet<ApprovalRow>({
		query: `SELECT * FROM approvals WHERE ${where.query} LIMIT 1`,
		params: where.params,
	});

	return row ? rowToApproval(row) : null;
}
