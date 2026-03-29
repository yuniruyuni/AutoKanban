import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { Approval } from "../../../models/approval";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import { approvalSpecToSQL } from "./common";

export function del(db: Database, spec: Approval.Spec): number {
	const where = compToSQL(
		spec,
		approvalSpecToSQL as (s: unknown) => SQLFragment,
	);
	const result = db
		.query<{ changes: number }, SQLQueryBindings[]>(
			`DELETE FROM approvals WHERE ${where.query}`,
		)
		.run(...(where.params as SQLQueryBindings[]));

	return result.changes;
}
