import type { PgDatabase } from "../../common";
import type { Approval } from "../../../models/approval";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../common";
import { type ApprovalRow, approvalSpecToSQL, rowToApproval } from "./common";

export async function get(
	db: PgDatabase,
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
