import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { Approval } from "../../../models/approval";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import { type ApprovalRow, approvalSpecToSQL, rowToApproval } from "./common";

export function get(db: Database, spec: Approval.Spec): Approval | null {
	const where = compToSQL(
		spec,
		approvalSpecToSQL as (s: unknown) => SQLFragment,
	);
	const row = db
		.query<ApprovalRow, SQLQueryBindings[]>(
			`SELECT * FROM approvals WHERE ${where.query} LIMIT 1`,
		)
		.get(...(where.params as SQLQueryBindings[]));

	return row ? rowToApproval(row) : null;
}
